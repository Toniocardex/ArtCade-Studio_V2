#include "editor-native/model/project_io.h"

#include <nlohmann/json.hpp>

#include <cmath>
#include <unordered_set>
#include <utility>

namespace ArtCade::EditorNative {

namespace {

constexpr int kCurrentSchemaVersion = 1;

nlohmann::json vec2ToJson(const Vec2& v) {
    return nlohmann::json{{"x", v.x}, {"y", v.y}};
}

nlohmann::json vec3ToJson(const Vec3& v) {
    return nlohmann::json{{"x", v.x}, {"y", v.y}, {"z", v.z}};
}

std::string readString(const nlohmann::json& object, const char* camel,
                       const char* snake = nullptr,
                       const std::string& fallback = {}) {
    if (object.contains(camel) && object[camel].is_string()) {
        return object[camel].get<std::string>();
    }
    if (snake && object.contains(snake) && object[snake].is_string()) {
        return object[snake].get<std::string>();
    }
    return fallback;
}

float readFloat(const nlohmann::json& object, const char* key, float fallback) {
    if (object.contains(key) && object[key].is_number()) {
        return object[key].get<float>();
    }
    return fallback;
}

Vec2 readVec2(const nlohmann::json& value, Vec2 fallback = {}) {
    if (!value.is_object()) return fallback;
    return Vec2{
        readFloat(value, "x", fallback.x),
        readFloat(value, "y", fallback.y),
    };
}

Vec4 readVec4(const nlohmann::json& value, Vec4 fallback = {}) {
    if (!value.is_object()) return fallback;
    return Vec4{
        readFloat(value, "r", fallback.r),
        readFloat(value, "g", fallback.g),
        readFloat(value, "b", fallback.b),
        readFloat(value, "a", fallback.a),
    };
}

Vec3 readVec3(const nlohmann::json& value, Vec3 fallback = {}) {
    if (!value.is_object()) return fallback;
    return Vec3{
        readFloat(value, "x", fallback.x),
        readFloat(value, "y", fallback.y),
        readFloat(value, "z", fallback.z),
    };
}

Transform readTransform(const nlohmann::json& value) {
    Transform transform;
    if (!value.is_object()) return transform;
    if (value.contains("position")) transform.position = readVec2(value["position"]);
    if (value.contains("scale")) transform.scale = readVec2(value["scale"], {1.f, 1.f});
    transform.rotation = readFloat(value, "rotation", 0.f);
    return transform;
}

bool readInstance(const nlohmann::json& value, SceneInstanceDef& out) {
    if (!value.is_object()) return false;
    out = SceneInstanceDef{};
    out.id = value.value("id", 0u);
    out.objectTypeId = readString(value, "objectTypeId", "object_type_id");
    out.instanceName = readString(value, "instanceName", "instance_name");
    if (value.contains("transform")) out.transform = readTransform(value["transform"]);
    if (value.contains("visible") && value["visible"].is_boolean()) {
        out.visible = value["visible"].get<bool>();
    }
    out.layerId = readString(value, "layerId", "layer_id");
    if (value.contains("spriteRenderer") && value["spriteRenderer"].is_object()) {
        const auto& sr = value["spriteRenderer"];
        SpriteRendererComponent component;
        component.imageAssetId = readString(sr, "imageAssetId", "image_asset_id");
        component.visible = sr.value("visible", true);
        out.spriteRenderer = component;
    }
    return out.id != INVALID_ENTITY && !out.objectTypeId.empty();
}

SceneDef readScene(const nlohmann::json& value, const SceneId& fallbackId) {
    SceneDef scene;
    if (!value.is_object()) return scene;
    scene.id = readString(value, "id", nullptr, fallbackId);
    scene.name = readString(value, "name", nullptr, scene.id);
    if (value.contains("worldSize")) {
        scene.worldSize = readVec2(value["worldSize"], scene.worldSize);
    }
    if (value.contains("viewportSize")) {
        scene.viewportSize = readVec2(value["viewportSize"], scene.viewportSize);
    }
    if (value.contains("backgroundColor")) {
        scene.backgroundColor = readVec4(value["backgroundColor"], scene.backgroundColor);
    }
    if (value.contains("instances") && value["instances"].is_array()) {
        for (const auto& item : value["instances"]) {
            SceneInstanceDef instance;
            if (readInstance(item, instance)) scene.instances.push_back(std::move(instance));
        }
    }
    if (value.contains("layers") && value["layers"].is_array()) {
        for (const auto& item : value["layers"]) {
            if (!item.is_object()) continue;
            SceneLayerDef layer;
            layer.id = readString(item, "id", nullptr);
            layer.name = readString(item, "name", nullptr, layer.id);
            if (!layer.id.empty()) scene.layers.push_back(layer);
        }
    }
    scene.defaultLayerId = readString(value, "defaultLayerId", "default_layer_id");

    // Migration: every scene must have a real Default layer; normalize the
    // default id and every instance to a real layer (legacy "" / dangling ->
    // default). No fictitious fallback survives past load.
    const auto layerExists = [&](const std::string& id) {
        for (const SceneLayerDef& l : scene.layers) if (l.id == id) return true;
        return false;
    };
    if (scene.layers.empty()) {
        scene.layers.push_back(SceneLayerDef{"default", "Default", false});
        scene.defaultLayerId = "default";
    }
    if (!layerExists(scene.defaultLayerId)) scene.defaultLayerId = scene.layers.front().id;
    for (SceneInstanceDef& inst : scene.instances) {
        if (!layerExists(inst.layerId)) inst.layerId = scene.defaultLayerId;
    }
    return scene;
}

SceneId duplicateKeyFor(const SceneId& id, std::size_t index) {
    return id + "#duplicate-" + std::to_string(index);
}

void insertReadScene(ProjectDoc& out, SceneDef scene) {
    SceneId key = scene.id;
    if (out.scenes.find(key) != out.scenes.end()) {
        key = duplicateKeyFor(scene.id, out.scenes.size());
    }
    out.scenes.emplace(std::move(key), std::move(scene));
}

void readScenes(const nlohmann::json& root, ProjectDoc& out) {
    if (!root.contains("scenes")) return;
    const auto& scenes = root["scenes"];
    if (scenes.is_array()) {
        for (const auto& item : scenes) {
            SceneDef scene = readScene(item, "scene_" + std::to_string(out.scenes.size()));
            insertReadScene(out, std::move(scene));
        }
    } else if (scenes.is_object()) {
        for (const auto& [key, value] : scenes.items()) {
            SceneDef scene = readScene(value, key);
            insertReadScene(out, std::move(scene));
        }
    }
}

nlohmann::json vec4ToJson(const Vec4& v) {
    return nlohmann::json{{"r", v.r}, {"g", v.g}, {"b", v.b}, {"a", v.a}};
}

nlohmann::json transformToJson(const Transform& t) {
    return nlohmann::json{
        {"position", vec2ToJson(t.position)},
        {"scale", vec2ToJson(t.scale)},
        {"rotation", t.rotation},
    };
}

nlohmann::json instanceToJson(const SceneInstanceDef& instance) {
    nlohmann::json json{
        {"id", instance.id},
        {"objectTypeId", instance.objectTypeId},
        {"instanceName", instance.instanceName},
        {"transform", transformToJson(instance.transform)},
        {"visible", instance.visible},
        {"layerId", instance.layerId},
    };
    if (instance.spriteRenderer.has_value()) {
        json["spriteRenderer"] = nlohmann::json{
            {"imageAssetId", instance.spriteRenderer->imageAssetId},
            {"visible", instance.spriteRenderer->visible},
        };
    }
    return json;
}

// Minimal object-type persistence: only the fields the native editor resolves
// or renders (id, name, visible, sprite asset + fill). The full EntityDef bag is
// deliberately not serialized by the spike.
nlohmann::json objectTypeToJson(const std::string& id, const EntityDef& def) {
    nlohmann::json json{
        {"id", id},
        {"name", def.name},
        {"visible", def.visible},
        {"sprite", nlohmann::json{
            {"spriteAssetId", def.sprite.spriteAssetId},
            {"fillColor", vec3ToJson(def.sprite.fillColor)},
        }},
    };
    if (def.boxCollider2D.has_value()) {
        json["boxCollider2D"] = nlohmann::json{
            {"offset", vec2ToJson(def.boxCollider2D->offset)},
            {"size", vec2ToJson(def.boxCollider2D->size)},
            {"enabled", def.boxCollider2D->enabled},
            {"isTrigger", def.boxCollider2D->isTrigger},
        };
    }
    if (def.linearMover.has_value()) {
        // _paused is a runtime flag, deliberately not persisted.
        json["linearMover"] = nlohmann::json{
            {"directionX", def.linearMover->directionX},
            {"directionY", def.linearMover->directionY},
            {"speed", def.linearMover->speed},
        };
    }
    if (def.topDownController.has_value()) {
        json["topDownController"] = nlohmann::json{
            {"maxSpeed", def.topDownController->maxSpeed},
            {"acceleration", def.topDownController->acceleration},
            {"friction", def.topDownController->friction},
            {"fourDirections", def.topDownController->fourDirections},
        };
    }
    if (def.platformerController.has_value()) {
        // Native editor persists the authored subset: Move Speed / Jump Speed /
        // Gravity (the other canonical fields stay at their defaults on load).
        json["platformerController"] = nlohmann::json{
            {"moveSpeed", def.platformerController->maxSpeed},
            {"jumpSpeed", def.platformerController->jumpForce},
            {"gravity", def.platformerController->customGravity},
        };
    }
    return json;
}

nlohmann::json sceneToJson(const SceneDef& scene) {
    nlohmann::json instances = nlohmann::json::array();
    for (const SceneInstanceDef& instance : scene.instances) {
        instances.push_back(instanceToJson(instance));
    }
    // Per-scene render layers: the order of the array IS the render order.
    nlohmann::json layers = nlohmann::json::array();
    for (const SceneLayerDef& layer : scene.layers) {
        layers.push_back(nlohmann::json{{"id", layer.id}, {"name", layer.name}});
    }

    return nlohmann::json{
        {"id", scene.id},
        {"name", scene.name},
        {"worldSize", vec2ToJson(scene.worldSize)},
        {"viewportSize", vec2ToJson(scene.viewportSize)},
        {"backgroundColor", vec4ToJson(scene.backgroundColor)},
        {"layers", std::move(layers)},
        {"defaultLayerId", scene.defaultLayerId},
        {"instances", std::move(instances)},
    };
}

} // namespace

DeserializeResult ProjectSerializer::deserialize(std::string_view source) {
    const nlohmann::json root =
        nlohmann::json::parse(source.begin(), source.end(), nullptr, false);
    if (root.is_discarded() || !root.is_object()) {
        return DeserializeResult::failure("Project JSON is malformed");
    }

    ProjectDoc doc;
    doc.projectName = readString(root, "projectName", "project_name", "Untitled");
    doc.version = readString(root, "version", nullptr, "2.0.0");
    doc.licenseTier = readString(root, "licenseTier", "license_tier", "free");
    doc.targetFPS = readFloat(root, "targetFPS", 60.f);
    doc.activeSceneId = readString(root, "activeSceneId", "active_scene_id");
    doc.mainScriptPath = readString(root, "mainScriptPath", "main_script_path",
                                    "scripts/main.luac");
    doc.formatVersion = root.value("formatVersion", root.value("format_version", 0));
    readScenes(root, doc);

    if (root.contains("objectTypes") && root["objectTypes"].is_array()) {
        std::unordered_set<std::string> seenTypeIds;
        for (const auto& item : root["objectTypes"]) {
            if (!item.is_object()) continue;
            const std::string id = readString(item, "id", "className");
            if (id.empty()) continue;
            if (!seenTypeIds.insert(id).second) {
                return DeserializeResult::failure("Duplicate object type id");
            }
            EntityDef def;
            def.className = id;
            def.name = readString(item, "name", nullptr, id);
            def.visible = item.value("visible", true);
            if (item.contains("sprite") && item["sprite"].is_object()) {
                const auto& sprite = item["sprite"];
                def.sprite.spriteAssetId = readString(sprite, "spriteAssetId", "sprite_asset_id");
                if (sprite.contains("fillColor")) {
                    def.sprite.fillColor = readVec3(sprite["fillColor"], def.sprite.fillColor);
                }
            }
            if (item.contains("boxCollider2D") && item["boxCollider2D"].is_object()) {
                const auto& collider = item["boxCollider2D"];
                BoxCollider2DComponent component;
                if (collider.contains("offset")) {
                    component.offset = readVec2(collider["offset"], component.offset);
                }
                if (collider.contains("size")) {
                    component.size = readVec2(collider["size"], component.size);
                }
                if (collider.contains("enabled") && collider["enabled"].is_boolean()) {
                    component.enabled = collider["enabled"].get<bool>();
                }
                if (collider.contains("isTrigger") && collider["isTrigger"].is_boolean()) {
                    component.isTrigger = collider["isTrigger"].get<bool>();
                }
                def.boxCollider2D = component;
            }
            if (item.contains("linearMover") && item["linearMover"].is_object()) {
                const auto& m = item["linearMover"];
                LinearMoverComponent component;
                component.directionX = m.value("directionX", component.directionX);
                component.directionY = m.value("directionY", component.directionY);
                component.speed = m.value("speed", component.speed);
                def.linearMover = component;
            }
            if (item.contains("topDownController") && item["topDownController"].is_object()) {
                const auto& t = item["topDownController"];
                TopDownControllerComponent component;
                component.maxSpeed = t.value("maxSpeed", component.maxSpeed);
                component.acceleration = t.value("acceleration", component.acceleration);
                component.friction = t.value("friction", component.friction);
                component.fourDirections = t.value("fourDirections", component.fourDirections);
                def.topDownController = component;
            }
            if (item.contains("platformerController") && item["platformerController"].is_object()) {
                const auto& p = item["platformerController"];
                PlatformerControllerComponent component;   // others keep defaults
                component.maxSpeed      = p.value("moveSpeed", component.maxSpeed);
                component.jumpForce     = p.value("jumpSpeed", component.jumpForce);
                component.customGravity = p.value("gravity", component.customGravity);
                def.platformerController = component;
            }
            doc.objectTypes.emplace(id, std::move(def));
        }
    }

    if (root.contains("imageAssets") && root["imageAssets"].is_array()) {
        for (const auto& item : root["imageAssets"]) {
            if (!item.is_object()) continue;
            const std::string assetId = readString(item, "assetId", "asset_id");
            if (assetId.empty()) continue;
            ImageAssetDef asset;
            asset.assetId = assetId;
            asset.sourcePath = readString(item, "sourcePath", "source_path");
            doc.imageAssets.push_back(std::move(asset));
        }
    }

    if (root.contains("audioAssets") && root["audioAssets"].is_array()) {
        for (const auto& item : root["audioAssets"]) {
            if (!item.is_object()) continue;
            const std::string assetId = readString(item, "assetId", "asset_id");
            if (assetId.empty()) continue;
            AudioAssetDef asset;
            asset.assetId = assetId;
            asset.sourcePath = readString(item, "sourcePath", "source_path");
            asset.loadMode = readString(item, "loadMode", nullptr) == "stream"
                                 ? AudioLoadMode::Stream : AudioLoadMode::StaticSound;
            doc.audioAssets.push_back(std::move(asset));
        }
    }

    if (root.contains("fontAssets") && root["fontAssets"].is_array()) {
        for (const auto& item : root["fontAssets"]) {
            if (!item.is_object()) continue;
            const std::string assetId = readString(item, "assetId", "asset_id");
            if (assetId.empty()) continue;
            FontAssetDef asset;
            asset.assetId = assetId;
            asset.sourcePath = readString(item, "sourcePath", "source_path");
            asset.defaultPixelSize = item.value("defaultPixelSize", 32);
            const std::string preset = readString(item, "glyphPreset", nullptr, "european");
            asset.glyphPreset = preset == "basicLatin" ? FontGlyphPreset::BasicLatin
                              : preset == "customText" ? FontGlyphPreset::CustomText
                                                       : FontGlyphPreset::European;
            doc.fontAssets.push_back(std::move(asset));
        }
    }

    return DeserializeResult::success(ProjectDocument{std::move(doc)});
}

SerializeResult ProjectSerializer::serialize(const ProjectDocument& document) {
    const ProjectDoc& doc = document.data();
    nlohmann::json scenes = nlohmann::json::array();
    for (const auto& [_, scene] : doc.scenes) {
        scenes.push_back(sceneToJson(scene));
    }

    nlohmann::json objectTypes = nlohmann::json::array();
    for (const auto& [id, def] : doc.objectTypes) {
        objectTypes.push_back(objectTypeToJson(id, def));
    }

    nlohmann::json imageAssets = nlohmann::json::array();
    for (const ImageAssetDef& asset : doc.imageAssets) {
        imageAssets.push_back(nlohmann::json{
            {"assetId", asset.assetId},
            {"sourcePath", asset.sourcePath},
        });
    }

    nlohmann::json audioAssets = nlohmann::json::array();
    for (const AudioAssetDef& asset : doc.audioAssets) {
        audioAssets.push_back(nlohmann::json{
            {"assetId", asset.assetId},
            {"sourcePath", asset.sourcePath},
            {"loadMode", asset.loadMode == AudioLoadMode::Stream ? "stream" : "static"},
        });
    }

    nlohmann::json fontAssets = nlohmann::json::array();
    for (const FontAssetDef& asset : doc.fontAssets) {
        const char* preset = asset.glyphPreset == FontGlyphPreset::BasicLatin ? "basicLatin"
                           : asset.glyphPreset == FontGlyphPreset::CustomText ? "customText"
                                                                              : "european";
        fontAssets.push_back(nlohmann::json{
            {"assetId", asset.assetId},
            {"sourcePath", asset.sourcePath},
            {"defaultPixelSize", asset.defaultPixelSize},
            {"glyphPreset", preset},
        });
    }

    nlohmann::json root{
        {"schemaVersion", kCurrentSchemaVersion},
        {"formatVersion", kCurrentSchemaVersion},
        {"projectName", doc.projectName},
        {"version", doc.version},
        {"activeSceneId", doc.activeSceneId},
        {"targetFPS", doc.targetFPS},
        {"mainScriptPath", doc.mainScriptPath},
        {"scenes", std::move(scenes)},
        {"objectTypes", std::move(objectTypes)},
        {"imageAssets", std::move(imageAssets)},
        {"audioAssets", std::move(audioAssets)},
        {"fontAssets", std::move(fontAssets)},
    };
    return SerializeResult::success(root.dump(2));
}

DeserializeResult ProjectMigration::migrate(ProjectDocument document) {
    const int version = document.data().formatVersion;
    if (version < 0 || version > kCurrentSchemaVersion) {
        return DeserializeResult::failure("Unsupported project schema version");
    }
    return DeserializeResult::success(std::move(document));
}

DeserializeResult ProjectValidator::validate(ProjectDocument document) {
    const ProjectDoc& data = document.data();

    std::unordered_set<SceneId> sceneIds;
    for (const auto& [id, scene] : data.scenes) {
        if (id.empty() || scene.id.empty()) {
            return DeserializeResult::failure("Scene id cannot be empty");
        }
        if (!sceneIds.insert(scene.id).second) {
            return DeserializeResult::failure("Duplicate scene id");
        }
        if (id != scene.id) {
            return DeserializeResult::failure("Scene map key does not match scene id");
        }

        // Per-scene layer invariants (only when the scene declares layers; a
        // legacy/in-memory scene with none renders its instances directly).
        std::unordered_set<std::string> layerIds;
        if (!scene.layers.empty()) {
            for (const SceneLayerDef& layer : scene.layers) {
                if (layer.id.empty()) {
                    return DeserializeResult::failure("Scene layer id cannot be empty");
                }
                if (!layerIds.insert(layer.id).second) {
                    return DeserializeResult::failure("Duplicate scene layer id");
                }
            }
            if (scene.defaultLayerId.empty() || layerIds.count(scene.defaultLayerId) == 0) {
                return DeserializeResult::failure(
                    "Scene defaultLayerId must reference an existing layer");
            }
        }

        std::unordered_set<EntityId> entityIds;
        for (const SceneInstanceDef& instance : scene.instances) {
            if (instance.id == INVALID_ENTITY) {
                return DeserializeResult::failure("Entity id cannot be zero");
            }
            if (!entityIds.insert(instance.id).second) {
                return DeserializeResult::failure("Duplicate entity id in scene");
            }
            if (instance.objectTypeId.empty()) {
                return DeserializeResult::failure("Entity objectTypeId cannot be empty");
            }
            // When the scene has layers, an instance must reference a real one.
            if (!scene.layers.empty() && !instance.layerId.empty()
                && layerIds.count(instance.layerId) == 0) {
                return DeserializeResult::failure("Instance references a missing scene layer");
            }
            // When the project defines an object-type catalog, every instance must
            // reference an existing type (a dangling reference is rejected). A
            // catalog-less minimal project leaves objectTypeId as a free label.
            if (!data.objectTypes.empty()
                && data.objectTypes.find(instance.objectTypeId) == data.objectTypes.end()) {
                return DeserializeResult::failure("Instance references a missing object type");
            }
            // A sprite renderer's asset reference must resolve to an image asset.
            if (instance.spriteRenderer.has_value()) {
                const AssetId& assetId = instance.spriteRenderer->imageAssetId;
                if (!assetId.empty() && !document.hasImageAsset(assetId)) {
                    return DeserializeResult::failure(
                        "Sprite renderer references a missing image asset");
                }
            }
        }
    }

    // An inherited sprite asset (on the object type) is validated like an override.
    for (const auto& [typeId, def] : data.objectTypes) {
        (void)typeId;
        const AssetId& assetId = def.sprite.spriteAssetId;
        if (!assetId.empty() && !document.hasImageAsset(assetId)) {
            return DeserializeResult::failure(
                "Object type sprite references a missing image asset");
        }
        if (def.boxCollider2D.has_value()) {
            const Vec2 size = def.boxCollider2D->size;
            if (!std::isfinite(def.boxCollider2D->offset.x)
                || !std::isfinite(def.boxCollider2D->offset.y)
                || !std::isfinite(size.x)
                || !std::isfinite(size.y)
                || size.x <= 0.f
                || size.y <= 0.f) {
                return DeserializeResult::failure("BoxCollider2D size must be positive");
            }
        }
        if (def.linearMover.has_value()) {
            if (!std::isfinite(def.linearMover->directionX)
                || !std::isfinite(def.linearMover->directionY)
                || !std::isfinite(def.linearMover->speed)
                || def.linearMover->speed < 0.f) {
                return DeserializeResult::failure("LinearMover has invalid direction or speed");
            }
        }
        if (def.topDownController.has_value()) {
            const TopDownControllerComponent& tdc = *def.topDownController;
            if (!std::isfinite(tdc.maxSpeed) || tdc.maxSpeed < 0.f
                || !std::isfinite(tdc.acceleration) || !std::isfinite(tdc.friction)) {
                return DeserializeResult::failure("TopDownController has invalid speed");
            }
        }
        if (def.platformerController.has_value()) {
            const PlatformerControllerComponent& pc = *def.platformerController;
            if (!std::isfinite(pc.maxSpeed) || pc.maxSpeed < 0.f
                || !std::isfinite(pc.jumpForce) || pc.jumpForce < 0.f
                || !std::isfinite(pc.customGravity) || pc.customGravity < 0.f) {
                return DeserializeResult::failure("PlatformerController has invalid values");
            }
        }
        // One movement writer per object type is a project invariant, not just a
        // runtime convenience: reject a file that carries several rather than
        // silently letting materialize pick one by priority.
        const int movementDrivers = (def.linearMover.has_value() ? 1 : 0)
                                  + (def.topDownController.has_value() ? 1 : 0)
                                  + (def.platformerController.has_value() ? 1 : 0);
        if (movementDrivers > 1) {
            return DeserializeResult::failure(
                "Object type has multiple movement drivers (only one is allowed)");
        }
    }

    if (!data.scenes.empty()) {
        if (data.activeSceneId.empty()) {
            return DeserializeResult::failure("startSceneId cannot be empty when scenes exist");
        }
        if (data.scenes.find(data.activeSceneId) == data.scenes.end()) {
            return DeserializeResult::failure("startSceneId references a missing scene");
        }
    }

    return DeserializeResult::success(std::move(document));
}

} // namespace ArtCade::EditorNative
