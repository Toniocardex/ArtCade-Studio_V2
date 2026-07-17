#include "artcade/editor_core/editor_core.h"

#include "asset-json.h"
#include "entity-json.h"
#include "logic-core.h"
#include "project-meta-json.h"
#include "project-current-format.h"
#include "scene-json.h"

#include <fstream>
#include <nlohmann/json.hpp>
#include <variant>

namespace ArtCade::EditorCore {
namespace {

nlohmann::json vec2_to_json(const Vec2 &v)
{
    return nlohmann::json{{"x", v.x}, {"y", v.y}};
}

nlohmann::json transform_to_json(const Transform &t)
{
    return nlohmann::json{
        {"position", vec2_to_json(t.position)},
        {"scale", vec2_to_json(t.scale)},
        {"rotation", t.rotation},
    };
}

nlohmann::json instance_to_json(const SceneInstanceDef &inst)
{
    nlohmann::json j{
        {"id", inst.id},
        {"objectTypeId", inst.objectTypeId},
        {"instanceName", inst.instanceName},
        {"transform", transform_to_json(inst.transform)},
        {"visible", inst.visible},
    };
    j["layerId"] = inst.layerId;
    return j;
}

nlohmann::json object_type_to_json(const std::string &key, const EntityDef &type)
{
    nlohmann::json j{
        {"id", key},
        {"displayName", type.name.empty() ? key : type.name},
        {"tags", nlohmann::json::array()},
    };
    if (type.logicBoard) {
        j["logicBoard"] = ArtCade::Logic::logicBoardToJson(*type.logicBoard);
    }
    // Persist optional components that load already supports (Logic Catalog availability).
    if (type.platformerController) {
        const PlatformerControllerComponent &pc = *type.platformerController;
        j["platformerController"] = {
            {"maxSpeed", pc.maxSpeed},
            {"jumpForce", pc.jumpForce},
            {"customGravity", pc.customGravity},
            {"coyoteTime", pc.coyoteTime},
            {"jumpBuffer", pc.jumpBuffer},
            {"climbSpeed", pc.climbSpeed},
        };
    }
    if (type.spriteRenderer) {
        const SpriteRendererComponent &sr = *type.spriteRenderer;
        j["spriteRenderer"] = {
            {"imageAssetId", sr.imageAssetId},
            {"animationAssetId", sr.animationAssetId},
            {"visible", sr.visible},
        };
    }
    if (type.spriteAnimator) {
        const SpriteAnimatorComponent &sa = *type.spriteAnimator;
        j["spriteAnimator"] = {
            {"initialClipId", sa.initialClipId},
            {"autoPlay", sa.autoPlay},
            {"playbackSpeed", sa.playbackSpeed},
        };
    }
    return j;
}

bool read_object_type_logic_boards(const nlohmann::json &root,
                                   ProjectDoc &out,
                                   std::string &error_message)
{
    if (!root.contains("objectTypes") || !root["objectTypes"].is_object()) {
        return true;
    }
    for (const auto &[map_key, raw_type] : root["objectTypes"].items()) {
        if (!raw_type.is_object() || !raw_type.contains("logicBoard")) {
            continue;
        }
        const ObjectTypeId type_id = raw_type.value("id", map_key);
        auto type_it = out.objectTypes.find(type_id);
        if (type_it == out.objectTypes.end()) {
            type_it = out.objectTypes.find(map_key);
        }
        if (type_it == out.objectTypes.end()) {
            error_message = "logicBoard refers to unknown object type: " + type_id;
            return false;
        }
        LogicBoardDef board;
        const ArtCade::Logic::LogicJsonResult parsed =
            ArtCade::Logic::logicBoardFromJson(raw_type["logicBoard"], board);
        if (!parsed.ok) {
            error_message = "Invalid logicBoard on object type " + type_id + ": " + parsed.error;
            return false;
        }
        type_it->second.logicBoard = std::move(board);
    }
    return true;
}

nlohmann::json layer_to_json(const SceneLayerDef &layer)
{
    return nlohmann::json{
        {"id", layer.id},
        {"name", layer.name.empty() ? layer.id : layer.name},
        {"locked", layer.locked},
    };
}

nlohmann::json layer_settings_to_json(const SceneLayerSettings &settings)
{
    return nlohmann::json{
        {"visible", settings.visible},
        {"opacity", settings.opacity},
        {"parallax", {
            {"x", settings.parallax.x},
            {"y", settings.parallax.y},
        }},
        {"background", {
            {"imageId", settings.background.imageId},
            {"tileX", settings.background.tileX},
            {"tileY", settings.background.tileY},
            {"scrollX", settings.background.scrollX},
            {"scrollY", settings.background.scrollY},
        }},
    };
}

nlohmann::json image_asset_to_json(const ImageAssetDef &asset)
{
    return nlohmann::json{
        {"assetId", asset.assetId},
        {"name", asset.name.empty() ? asset.assetId : asset.name},
        {"sourcePath", asset.sourcePath},
    };
}

} // namespace

SceneInstanceDef *project_doc_find_instance(ProjectDoc &doc, EntityId entity_id)
{
    if (entity_id == 0) {
        return nullptr;
    }
    for (auto &[scene_id, scene] : doc.scenes) {
        (void)scene_id;
        for (SceneInstanceDef &inst : scene.instances) {
            if (inst.id == entity_id) {
                return &inst;
            }
        }
    }
    return nullptr;
}

const SceneInstanceDef *project_doc_find_instance(const ProjectDoc &doc, EntityId entity_id)
{
    return project_doc_find_instance(const_cast<ProjectDoc &>(doc), entity_id);
}

SceneInstanceDef *project_doc_find_instance_in_scene(ProjectDoc &doc,
                                                     const SceneId &scene_id,
                                                     EntityId entity_id)
{
    if (entity_id == 0 || scene_id.empty()) {
        return nullptr;
    }
    auto scene_it = doc.scenes.find(scene_id);
    if (scene_it == doc.scenes.end()) {
        return nullptr;
    }
    for (SceneInstanceDef &inst : scene_it->second.instances) {
        if (inst.id == entity_id) {
            return &inst;
        }
    }
    return nullptr;
}

const SceneInstanceDef *project_doc_find_instance_in_scene(const ProjectDoc &doc,
                                                           const SceneId &scene_id,
                                                           EntityId entity_id)
{
    return project_doc_find_instance_in_scene(const_cast<ProjectDoc &>(doc), scene_id, entity_id);
}

bool project_doc_locate_instance(const ProjectDoc &doc,
                                 EntityId entity_id,
                                 SceneId &out_scene_id,
                                 const SceneInstanceDef *&out_instance)
{
    out_scene_id.clear();
    out_instance = nullptr;
    if (entity_id == 0) {
        return false;
    }
    for (const auto &[scene_id, scene] : doc.scenes) {
        for (const SceneInstanceDef &inst : scene.instances) {
            if (inst.id == entity_id) {
                out_scene_id = scene_id;
                out_instance = &inst;
                return true;
            }
        }
    }
    return false;
}

bool project_file_io_load(const std::string &project_json_path,
                          ProjectDoc &out,
                          std::string &error_message)
{
    std::ifstream file(project_json_path);
    if (!file) {
        error_message = "Cannot open project file: " + project_json_path;
        return false;
    }

    nlohmann::json root;
    try {
        root = nlohmann::json::parse(file);
    } catch (const std::exception &ex) {
        error_message = std::string("Invalid JSON: ") + ex.what();
        return false;
    }

    if (!ProjectJson::validate_current_project_json(root, error_message)) {
        return false;
    }

    out = ProjectDoc{};
    ProjectJson::read_project_header(root, out);
    out.formatVersion = kCurrentProjectFormatVersion;
    if (root.contains("world") && root["world"].is_object()) {
        ProjectJson::read_world_settings(root["world"], out.world);
    }
    ProjectJson::read_object_types_map(root, out.objectTypes);
    if (!read_object_type_logic_boards(root, out, error_message)) {
        return false;
    }
    ProjectJson::read_scenes_map(root, out.scenes);
    ProjectJson::read_global_variables(root, out);
    ProjectJson::read_image_assets(root, out.imageAssets);

    if (!ProjectJson::validate_current_project_document(out, error_message)) {
        return false;
    }
    return true;
}

bool project_file_io_save(const std::string &project_json_path,
                          const ProjectDoc &doc,
                          std::string &error_message)
{
    if (!ProjectJson::validate_current_project_document(doc, error_message)) {
        return false;
    }
    nlohmann::json root;
    root["formatVersion"] = kCurrentProjectFormatVersion;
    root["projectName"] = doc.projectName;
    root["version"] = doc.version.empty() ? "1.0.0" : doc.version;
    root["targetFPS"] = doc.targetFPS;
    root["activeSceneId"] = doc.activeSceneId;
    root["mainScriptPath"] =
        doc.mainScriptPath.empty() ? "scripts/main.lua" : doc.mainScriptPath;

    nlohmann::json image_assets = nlohmann::json::array();
    for (const ImageAssetDef &asset : doc.imageAssets) {
        if (!asset.assetId.empty()) {
            image_assets.push_back(image_asset_to_json(asset));
        }
    }
    root["imageAssets"] = std::move(image_assets);

    nlohmann::json object_types = nlohmann::json::object();
    for (const auto &[key, type] : doc.objectTypes) {
        object_types[key] = object_type_to_json(key, type);
    }
    root["objectTypes"] = std::move(object_types);

    nlohmann::json scenes = nlohmann::json::object();
    for (const auto &[scene_id, scene] : doc.scenes) {
        nlohmann::json sj;
        sj["id"] = scene.id.empty() ? scene_id : scene.id;
        sj["name"] = scene.name;
        sj["worldSize"] = vec2_to_json(scene.worldSize);
        sj["viewportSize"] = vec2_to_json(scene.viewportSize);
        sj["cameraStart"] = vec2_to_json(scene.cameraStart);
        sj["backgroundColor"] = nlohmann::json{
            {"x", scene.backgroundColor.r},
            {"y", scene.backgroundColor.g},
            {"z", scene.backgroundColor.b},
            {"w", scene.backgroundColor.a},
        };
        nlohmann::json layers = nlohmann::json::array();
        for (const SceneLayerDef &layer : scene.layers) {
            if (!layer.id.empty()) {
                layers.push_back(layer_to_json(layer));
            }
        }
        sj["layers"] = std::move(layers);
        sj["defaultLayerId"] = scene.defaultLayerId;

        nlohmann::json instances = nlohmann::json::array();
        nlohmann::json entity_ids = nlohmann::json::array();
        for (const SceneInstanceDef &inst : scene.instances) {
            instances.push_back(instance_to_json(inst));
            entity_ids.push_back(inst.id);
        }
        sj["instances"] = std::move(instances);
        sj["entityIds"] = std::move(entity_ids);

        if (!scene.layerSettings.empty()) {
            nlohmann::json layer_settings = nlohmann::json::object();
            for (const auto &[layer_id, settings] : scene.layerSettings) {
                layer_settings[layer_id] = layer_settings_to_json(settings);
            }
            sj["layerSettings"] = std::move(layer_settings);
        }

        scenes[scene_id] = std::move(sj);
    }
    root["scenes"] = std::move(scenes);

    root["world"] = nlohmann::json{
        {"gravity", doc.world.gravity},
        {"pixelsPerMeter", doc.world.pixelsPerMeter},
        {"timeScale", doc.world.timeScale},
    };

    nlohmann::json global_variables = nlohmann::json::array();
    for (const GameVariableDefinition &def : doc.globalVariables) {
        nlohmann::json item;
        item["key"] = def.key;
        switch (def.type) {
        case GameVariableDefinition::Type::Number:
            item["type"] = "number";
            item["initialValue"] = std::get<double>(def.initialValue);
            break;
        case GameVariableDefinition::Type::Boolean:
            item["type"] = "boolean";
            item["initialValue"] = std::get<bool>(def.initialValue);
            break;
        case GameVariableDefinition::Type::String:
            item["type"] = "string";
            item["initialValue"] = std::get<std::string>(def.initialValue);
            break;
        }
        if (!def.description.empty()) item["description"] = def.description;
        global_variables.push_back(std::move(item));
    }
    root["globalVariables"] = std::move(global_variables);

    std::ofstream file(project_json_path);
    if (!file) {
        error_message = "Cannot write project file: " + project_json_path;
        return false;
    }
    file << root.dump(2);
    if (!file) {
        error_message = "Write failed: " + project_json_path;
        return false;
    }
    return true;
}

} // namespace ArtCade::EditorCore
