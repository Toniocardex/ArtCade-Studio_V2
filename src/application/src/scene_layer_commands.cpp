/**
 * Per-scene render layer Commands — Add / Rename / Set Default.
 * All operate on SceneDef.layers exclusively (SceneId + layer id).
 */
#include "artcade/editor_core/editor_core.h"

#include <algorithm>
#include <cctype>
#include <charconv>
#include <cstddef>
#include <string>

namespace ArtCade::EditorCore {
namespace {

std::string ascii_lower(std::string value)
{
    for (char &ch : value) {
        ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
    }
    return value;
}

std::string trim_whitespace(const std::string &value)
{
    std::size_t begin = 0;
    while (begin < value.size()
           && std::isspace(static_cast<unsigned char>(value[begin]))) {
        ++begin;
    }
    std::size_t end = value.size();
    while (end > begin && std::isspace(static_cast<unsigned char>(value[end - 1]))) {
        --end;
    }
    return value.substr(begin, end - begin);
}

bool name_taken_case_insensitive(const SceneDef &scene,
                                 const std::string &name,
                                 const std::string &except_layer_id)
{
    const std::string needle = ascii_lower(name);
    for (const SceneLayerDef &layer : scene.layers) {
        if (!except_layer_id.empty() && layer.id == except_layer_id) {
            continue;
        }
        const std::string candidate = layer.name.empty() ? layer.id : layer.name;
        if (ascii_lower(candidate) == needle) {
            return true;
        }
    }
    return false;
}

std::string allocate_layer_id(const SceneDef &scene)
{
    int max_n = 0;
    for (const SceneLayerDef &layer : scene.layers) {
        if (layer.id.rfind("layer_", 0) != 0) {
            continue;
        }
        const char *begin = layer.id.data() + 6;
        const char *end = layer.id.data() + layer.id.size();
        int n = 0;
        const auto parsed = std::from_chars(begin, end, n);
        if (parsed.ec != std::errc{} || parsed.ptr != end || n <= 0) {
            continue;
        }
        if (n > max_n) {
            max_n = n;
        }
    }
    return "layer_" + std::to_string(max_n + 1);
}

std::string next_available_layer_name(const SceneDef &scene)
{
    for (int n = 1; n < 10000; ++n) {
        const std::string candidate = "Layer " + std::to_string(n);
        if (!name_taken_case_insensitive(scene, candidate, {})) {
            return candidate;
        }
    }
    return "Layer";
}

std::string next_copy_layer_name(const SceneDef &scene, const std::string &base_name)
{
    const std::string base = base_name.empty() ? "Layer" : base_name;
    const std::string first = base + " Copy";
    if (!name_taken_case_insensitive(scene, first, {})) {
        return first;
    }
    for (int n = 2; n < 10000; ++n) {
        const std::string candidate = base + " Copy " + std::to_string(n);
        if (!name_taken_case_insensitive(scene, candidate, {})) {
            return candidate;
        }
    }
    return first;
}

bool instance_name_taken(const SceneDef &scene, const std::string &name)
{
    const std::string needle = ascii_lower(name);
    for (const SceneInstanceDef &inst : scene.instances) {
        if (ascii_lower(inst.instanceName) == needle) {
            return true;
        }
    }
    return false;
}

std::string next_copy_instance_name(const SceneDef &scene, const std::string &base_name)
{
    const std::string base = base_name.empty() ? "Instance" : base_name;
    const std::string first = base + " Copy";
    if (!instance_name_taken(scene, first)) {
        return first;
    }
    for (int n = 2; n < 10000; ++n) {
        const std::string candidate = base + " Copy " + std::to_string(n);
        if (!instance_name_taken(scene, candidate)) {
            return candidate;
        }
    }
    return first;
}

EntityId allocate_next_entity_id(const ProjectDoc &doc)
{
    EntityId max_id = 0;
    for (const auto &[scene_id, scene] : doc.scenes) {
        (void)scene_id;
        for (const SceneInstanceDef &inst : scene.instances) {
            if (inst.id > max_id) {
                max_id = inst.id;
            }
        }
    }
    return max_id + 1;
}

} // namespace

const SceneLayerDef *EditorCoordinator::findSceneLayer(const SceneDef &scene,
                                                       const std::string &layer_id)
{
    if (layer_id.empty()) {
        return nullptr;
    }
    for (const SceneLayerDef &layer : scene.layers) {
        if (layer.id == layer_id) {
            return &layer;
        }
    }
    return nullptr;
}

SceneLayerDef *EditorCoordinator::findSceneLayer(SceneDef &scene, const std::string &layer_id)
{
    return const_cast<SceneLayerDef *>(
        findSceneLayer(static_cast<const SceneDef &>(scene), layer_id));
}

std::size_t EditorCoordinator::sceneLayerIndex(const SceneDef &scene,
                                               const std::string &layer_id)
{
    for (std::size_t i = 0; i < scene.layers.size(); ++i) {
        if (scene.layers[i].id == layer_id) {
            return i;
        }
    }
    return static_cast<std::size_t>(-1);
}

bool EditorCoordinator::sceneContainsLayer(const SceneDef &scene, const std::string &layer_id)
{
    return findSceneLayer(scene, layer_id) != nullptr;
}

AddSceneLayerCommand::AddSceneLayerCommand(SceneId scene_id,
                                           std::string layer_id,
                                           std::string name,
                                           std::size_t insert_index)
    : m_scene_id(std::move(scene_id))
    , m_layer_id(std::move(layer_id))
    , m_name(std::move(name))
    , m_insert_index(insert_index)
{
}

void AddSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty() || m_name.empty()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    if (EditorCoordinator::sceneContainsLayer(scene, m_layer_id)) {
        return;
    }
    SceneLayerDef layer;
    layer.id = m_layer_id;
    layer.name = m_name;
    layer.locked = false;
    const std::size_t index = std::min(m_insert_index, scene.layers.size());
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(index),
                        std::move(layer));
    scene.layerSettings[m_layer_id] = SceneLayerSettings{};
    m_applied = true;
}

void AddSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    auto it = std::find_if(scene.layers.begin(),
                           scene.layers.end(),
                           [&](const SceneLayerDef &layer) { return layer.id == m_layer_id; });
    if (it != scene.layers.end()) {
        scene.layers.erase(it);
    }
    scene.layerSettings.erase(m_layer_id);
    m_applied = false;
}

RenameSceneLayerCommand::RenameSceneLayerCommand(SceneId scene_id,
                                                 std::string layer_id,
                                                 std::string new_name)
    : m_scene_id(std::move(scene_id))
    , m_layer_id(std::move(layer_id))
    , m_new_name(std::move(new_name))
{
}

void RenameSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty() || m_new_name.empty()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    SceneLayerDef *layer = EditorCoordinator::findSceneLayer(scene, m_layer_id);
    if (!layer) {
        return;
    }
    if (!m_captured) {
        m_old_name = layer->name;
        m_captured = true;
    }
    if (m_old_name == m_new_name) {
        return;
    }
    if (name_taken_case_insensitive(scene, m_new_name, m_layer_id)) {
        return;
    }
    layer->name = m_new_name;
    m_applied = true;
}

void RenameSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    if (SceneLayerDef *layer = EditorCoordinator::findSceneLayer(scene_it->second, m_layer_id)) {
        layer->name = m_old_name;
    }
    m_applied = false;
}

SetDefaultSceneLayerCommand::SetDefaultSceneLayerCommand(SceneId scene_id, std::string layer_id)
    : m_scene_id(std::move(scene_id))
    , m_layer_id(std::move(layer_id))
{
}

void SetDefaultSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    if (!EditorCoordinator::sceneContainsLayer(scene, m_layer_id)) {
        return;
    }
    if (!m_captured) {
        m_old_default = scene.defaultLayerId;
        m_captured = true;
    }
    if (scene.defaultLayerId == m_layer_id) {
        return;
    }
    scene.defaultLayerId = m_layer_id;
    m_applied = true;
}

void SetDefaultSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    scene_it->second.defaultLayerId = m_old_default;
    m_applied = false;
}

MoveSceneLayerCommand::MoveSceneLayerCommand(SceneId scene_id,
                                             std::string layer_id,
                                             std::size_t target_index)
    : m_scene_id(std::move(scene_id))
    , m_layer_id(std::move(layer_id))
    , m_target_index(target_index)
{
}

void MoveSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_layer_id.empty()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    const std::size_t from = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
    if (from == static_cast<std::size_t>(-1) || scene.layers.empty()) {
        return;
    }
    std::size_t target = m_target_index;
    if (target >= scene.layers.size()) {
        target = scene.layers.size() - 1;
    }
    if (!m_captured) {
        m_from_index = from;
        m_captured = true;
    }
    if (from == target) {
        return;
    }
    SceneLayerDef layer = std::move(scene.layers[from]);
    scene.layers.erase(scene.layers.begin() + static_cast<std::ptrdiff_t>(from));
    // After erase, insert so the layer ends at `target` in the final vector.
    std::size_t insert_at = target;
    if (insert_at > scene.layers.size()) {
        insert_at = scene.layers.size();
    }
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(insert_at),
                        std::move(layer));
    m_applied = true;
}

void MoveSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    const std::size_t current = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
    if (current == static_cast<std::size_t>(-1)) {
        return;
    }
    SceneLayerDef layer = std::move(scene.layers[current]);
    scene.layers.erase(scene.layers.begin() + static_cast<std::ptrdiff_t>(current));
    std::size_t insert_at = m_from_index;
    if (insert_at > scene.layers.size()) {
        insert_at = scene.layers.size();
    }
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(insert_at),
                        std::move(layer));
    m_applied = false;
}

bool EditorCoordinator::addSceneLayer(std::string &out_layer_id, std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneDef *scene = activeScene();
    if (!scene) {
        error_message = "No active scene";
        return false;
    }
    SceneId scene_id = m_doc.activeSceneId;
    if (m_doc.scenes.find(scene_id) == m_doc.scenes.end()) {
        scene_id = scene->id.empty() ? m_doc.scenes.begin()->first : scene->id;
    }

    const std::string layer_id = allocate_layer_id(*scene);
    const std::string name = next_available_layer_name(*scene);
    std::size_t insert_index = scene->layers.size();
    const std::size_t active_index = sceneLayerIndex(*scene, m_active_layer_id);
    if (active_index != static_cast<std::size_t>(-1)) {
        // Insert toward foreground (after active in SceneDef.layers order).
        insert_index = active_index + 1;
    }

    auto cmd = std::make_unique<AddSceneLayerCommand>(scene_id, layer_id, name, insert_index);
    AddSceneLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied()) {
        error_message = "Failed to add layer";
        return false;
    }
    bumpRevision();
    m_active_layer_id = layer_id;
    out_layer_id = layer_id;
    return true;
}

bool EditorCoordinator::renameSceneLayer(const std::string &layer_id,
                                         const std::string &new_name,
                                         std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneDef *scene = activeScene();
    if (!scene) {
        error_message = "No active scene";
        return false;
    }
    const std::string trimmed = trim_whitespace(new_name);
    if (trimmed.empty()) {
        error_message = "Layer name cannot be empty";
        return false;
    }
    const SceneLayerDef *layer = findSceneLayer(*scene, layer_id);
    if (!layer) {
        error_message = "Layer not found";
        return false;
    }
    const std::string current = layer->name.empty() ? layer->id : layer->name;
    if (current == trimmed) {
        return true; // no-op
    }
    if (name_taken_case_insensitive(*scene, trimmed, layer_id)) {
        error_message = "A layer with this name already exists in the scene";
        return false;
    }

    SceneId scene_id = m_doc.activeSceneId;
    if (m_doc.scenes.find(scene_id) == m_doc.scenes.end()) {
        scene_id = scene->id.empty() ? m_doc.scenes.begin()->first : scene->id;
    }
    auto cmd = std::make_unique<RenameSceneLayerCommand>(scene_id, layer_id, trimmed);
    RenameSceneLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied()) {
        error_message = "Failed to rename layer";
        return false;
    }
    bumpRevision();
    return true;
}

bool EditorCoordinator::setDefaultSceneLayer(const std::string &layer_id,
                                             std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneDef *scene = activeScene();
    if (!scene) {
        error_message = "No active scene";
        return false;
    }
    if (!sceneContainsLayer(*scene, layer_id)) {
        error_message = "Layer not found";
        return false;
    }
    if (scene->defaultLayerId == layer_id) {
        return true; // no-op
    }

    SceneId scene_id = m_doc.activeSceneId;
    if (m_doc.scenes.find(scene_id) == m_doc.scenes.end()) {
        scene_id = scene->id.empty() ? m_doc.scenes.begin()->first : scene->id;
    }
    auto cmd = std::make_unique<SetDefaultSceneLayerCommand>(scene_id, layer_id);
    SetDefaultSceneLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied()) {
        error_message = "Failed to set default layer";
        return false;
    }
    bumpRevision();
    return true;
}

bool EditorCoordinator::moveSceneLayer(const std::string &layer_id,
                                       std::size_t target_index,
                                       std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneDef *scene = activeScene();
    if (!scene) {
        error_message = "No active scene";
        return false;
    }
    if (!sceneContainsLayer(*scene, layer_id)) {
        error_message = "Layer not found";
        return false;
    }
    if (scene->layers.empty()) {
        error_message = "Scene has no layers";
        return false;
    }
    std::size_t target = target_index;
    if (target >= scene->layers.size()) {
        target = scene->layers.size() - 1;
    }
    const std::size_t from = sceneLayerIndex(*scene, layer_id);
    if (from == target) {
        return true; // no-op
    }

    SceneId scene_id = m_doc.activeSceneId;
    if (m_doc.scenes.find(scene_id) == m_doc.scenes.end()) {
        scene_id = scene->id.empty() ? m_doc.scenes.begin()->first : scene->id;
    }
    auto cmd = std::make_unique<MoveSceneLayerCommand>(scene_id, layer_id, target);
    MoveSceneLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied()) {
        error_message = "Failed to move layer";
        return false;
    }
    bumpRevision();
    return true;
}

SetEntityLayerCommand::SetEntityLayerCommand(SceneId scene_id,
                                             EntityId entity_id,
                                             std::string layer_id)
    : m_scene_id(std::move(scene_id))
    , m_entity_id(entity_id)
    , m_layer_id(std::move(layer_id))
{
}

void SetEntityLayerCommand::execute(ProjectDoc &doc)
{
    if (m_entity_id == 0 || m_layer_id.empty()) {
        return;
    }
    SceneInstanceDef *inst =
        project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    if (!inst) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()
        || !EditorCoordinator::sceneContainsLayer(scene_it->second, m_layer_id)) {
        return;
    }
    if (!m_captured) {
        m_old_layer_id = inst->layerId;
        m_captured = true;
    }
    if (inst->layerId == m_layer_id) {
        return;
    }
    inst->layerId = m_layer_id;
    m_applied = true;
}

void SetEntityLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    SceneInstanceDef *inst =
        project_doc_find_instance_in_scene(doc, m_scene_id, m_entity_id);
    if (!inst) {
        return;
    }
    inst->layerId = m_old_layer_id;
    m_applied = false;
}

bool EditorCoordinator::setEntityLayer(EntityId entity_id,
                                       const std::string &layer_id,
                                       std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (entity_id == 0) {
        error_message = "Invalid entity";
        return false;
    }
    if (layer_id.empty()) {
        error_message = "Empty layer id";
        return false;
    }
    SceneId scene_id;
    const SceneInstanceDef *inst = nullptr;
    if (!project_doc_locate_instance(m_doc, entity_id, scene_id, inst) || !inst) {
        error_message = "Entity not found";
        return false;
    }
    auto scene_it = m_doc.scenes.find(scene_id);
    if (scene_it == m_doc.scenes.end()
        || !sceneContainsLayer(scene_it->second, layer_id)) {
        error_message = "Layer not found in entity scene";
        return false;
    }
    if (inst->layerId == layer_id) {
        return true; // no-op
    }
    auto cmd = std::make_unique<SetEntityLayerCommand>(scene_id, entity_id, layer_id);
    SetEntityLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied()) {
        error_message = "Failed to set entity layer";
        return false;
    }
    bumpRevision();
    return true;
}

RemoveSceneLayerCommand::RemoveSceneLayerCommand(SceneId scene_id,
                                                 std::string layer_id,
                                                 std::string transfer_target_id)
    : m_scene_id(std::move(scene_id))
    , m_layer_id(std::move(layer_id))
    , m_transfer_target_id(std::move(transfer_target_id))
{
}

void RemoveSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    if (m_layer_id.empty() || m_transfer_target_id.empty()
        || m_layer_id == m_transfer_target_id) {
        return;
    }
    if (scene.layers.size() <= 1) {
        return;
    }
    if (scene.defaultLayerId == m_layer_id) {
        return;
    }
    if (!EditorCoordinator::sceneContainsLayer(scene, m_layer_id)
        || !EditorCoordinator::sceneContainsLayer(scene, m_transfer_target_id)) {
        return;
    }
    if (!m_captured) {
        m_from_index = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
        const SceneLayerDef *def = EditorCoordinator::findSceneLayer(scene, m_layer_id);
        if (!def) {
            return;
        }
        m_removed_def = *def;
        auto settings_it = scene.layerSettings.find(m_layer_id);
        m_had_settings = settings_it != scene.layerSettings.end();
        if (m_had_settings) {
            m_removed_settings = settings_it->second;
        }
        m_transferred_ids.clear();
        for (const SceneInstanceDef &inst : scene.instances) {
            if (inst.layerId == m_layer_id) {
                m_transferred_ids.push_back(inst.id);
            }
        }
        m_captured = true;
    }
    for (SceneInstanceDef &inst : scene.instances) {
        if (inst.layerId == m_layer_id) {
            inst.layerId = m_transfer_target_id;
        }
    }
    scene.layerSettings.erase(m_layer_id);
    const std::size_t index = EditorCoordinator::sceneLayerIndex(scene, m_layer_id);
    if (index >= scene.layers.size()) {
        return;
    }
    scene.layers.erase(scene.layers.begin()
                       + static_cast<std::ptrdiff_t>(index));
    m_applied = true;
}

void RemoveSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_captured) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    std::size_t insert_at = m_from_index;
    if (insert_at > scene.layers.size()) {
        insert_at = scene.layers.size();
    }
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(insert_at),
                        m_removed_def);
    if (m_had_settings) {
        scene.layerSettings[m_layer_id] = m_removed_settings;
    }
    for (const EntityId entity_id : m_transferred_ids) {
        SceneInstanceDef *inst =
            project_doc_find_instance_in_scene(doc, m_scene_id, entity_id);
        if (inst) {
            inst->layerId = m_layer_id;
        }
    }
    m_applied = false;
}

bool EditorCoordinator::removeSceneLayer(const std::string &layer_id,
                                         const std::string &transfer_target_id,
                                         std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneDef *scene = activeScene();
    if (!scene) {
        error_message = "No active scene";
        return false;
    }
    if (layer_id.empty() || transfer_target_id.empty()) {
        error_message = "Empty layer id";
        return false;
    }
    if (layer_id == transfer_target_id) {
        error_message = "Transfer target must be a different layer";
        return false;
    }
    if (scene->layers.size() <= 1) {
        error_message = "A scene must keep at least one layer";
        return false;
    }
    if (scene->defaultLayerId == layer_id) {
        error_message = "Cannot delete the default layer; set another default first";
        return false;
    }
    if (!sceneContainsLayer(*scene, layer_id)) {
        error_message = "Layer not found";
        return false;
    }
    if (!sceneContainsLayer(*scene, transfer_target_id)) {
        error_message = "Transfer target layer not found";
        return false;
    }

    SceneId scene_id = m_doc.activeSceneId;
    if (m_doc.scenes.find(scene_id) == m_doc.scenes.end()) {
        scene_id = scene->id.empty() ? m_doc.scenes.begin()->first : scene->id;
    }
    auto cmd = std::make_unique<RemoveSceneLayerCommand>(
        scene_id, layer_id, transfer_target_id);
    RemoveSceneLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied()) {
        error_message = "Failed to remove layer";
        return false;
    }
    m_hidden_layer_ids.erase(layer_id);
    if (m_active_layer_id == layer_id) {
        reconcileActiveLayerId();
    }
    bumpRevision();
    return true;
}

int EditorCoordinator::countInstancesOnLayer(const std::string &layer_id) const
{
    const SceneDef *scene = activeScene();
    if (!scene || layer_id.empty()) {
        return 0;
    }
    int count = 0;
    for (const SceneInstanceDef &inst : scene->instances) {
        if (inst.layerId == layer_id) {
            ++count;
        }
    }
    return count;
}

DuplicateSceneLayerCommand::DuplicateSceneLayerCommand(SceneId scene_id,
                                                       std::string source_layer_id)
    : m_scene_id(std::move(scene_id))
    , m_source_layer_id(std::move(source_layer_id))
{
}

void DuplicateSceneLayerCommand::execute(ProjectDoc &doc)
{
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end() || m_source_layer_id.empty()) {
        return;
    }
    SceneDef &scene = scene_it->second;
    if (!EditorCoordinator::sceneContainsLayer(scene, m_source_layer_id)) {
        return;
    }

    if (!m_planned) {
        const SceneLayerDef *source =
            EditorCoordinator::findSceneLayer(scene, m_source_layer_id);
        if (!source) {
            return;
        }
        m_new_layer_id = allocate_layer_id(scene);
        const std::string source_label =
            source->name.empty() ? source->id : source->name;
        m_new_layer_name = next_copy_layer_name(scene, source_label);
        m_insert_index = EditorCoordinator::sceneLayerIndex(scene, m_source_layer_id) + 1;

        m_new_layer_def.id = m_new_layer_id;
        m_new_layer_def.name = m_new_layer_name;
        m_new_layer_def.locked = source->locked;

        auto settings_it = scene.layerSettings.find(m_source_layer_id);
        m_copy_settings = settings_it != scene.layerSettings.end();
        if (m_copy_settings) {
            m_new_settings = settings_it->second;
        } else {
            m_new_settings = SceneLayerSettings{};
            m_copy_settings = true;
        }

        auto tile_it = scene.tilemapLayers.find(m_source_layer_id);
        m_copy_tilemap = tile_it != scene.tilemapLayers.end();
        if (m_copy_tilemap) {
            m_new_tilemap = tile_it->second;
        }

        EntityId next_id = allocate_next_entity_id(doc);
        // Plan unique names against the scene as it will grow.
        SceneDef name_probe = scene;
        m_new_instances.clear();
        for (const SceneInstanceDef &inst : scene.instances) {
            if (inst.layerId != m_source_layer_id) {
                continue;
            }
            SceneInstanceDef copy = inst;
            copy.id = next_id++;
            copy.layerId = m_new_layer_id;
            const std::string base =
                inst.instanceName.empty() ? inst.objectTypeId : inst.instanceName;
            copy.instanceName = next_copy_instance_name(name_probe, base);
            name_probe.instances.push_back(copy);
            m_new_instances.push_back(std::move(copy));
        }
        m_planned = true;
    }

    if (EditorCoordinator::sceneContainsLayer(scene, m_new_layer_id)) {
        return; // already applied / redo race
    }

    const std::size_t index = std::min(m_insert_index, scene.layers.size());
    scene.layers.insert(scene.layers.begin() + static_cast<std::ptrdiff_t>(index),
                        m_new_layer_def);
    if (m_copy_settings) {
        scene.layerSettings[m_new_layer_id] = m_new_settings;
    }
    if (m_copy_tilemap) {
        scene.tilemapLayers[m_new_layer_id] = m_new_tilemap;
    }
    for (const SceneInstanceDef &inst : m_new_instances) {
        scene.instances.push_back(inst);
    }
    m_applied = true;
}

void DuplicateSceneLayerCommand::undo(ProjectDoc &doc)
{
    if (!m_applied || !m_planned) {
        return;
    }
    auto scene_it = doc.scenes.find(m_scene_id);
    if (scene_it == doc.scenes.end()) {
        return;
    }
    SceneDef &scene = scene_it->second;

    for (const SceneInstanceDef &created : m_new_instances) {
        auto it = std::find_if(scene.instances.begin(),
                               scene.instances.end(),
                               [&](const SceneInstanceDef &inst) {
                                   return inst.id == created.id;
                               });
        if (it != scene.instances.end()) {
            scene.instances.erase(it);
        }
    }
    scene.tilemapLayers.erase(m_new_layer_id);
    scene.layerSettings.erase(m_new_layer_id);
    auto layer_it = std::find_if(scene.layers.begin(),
                                 scene.layers.end(),
                                 [&](const SceneLayerDef &layer) {
                                     return layer.id == m_new_layer_id;
                                 });
    if (layer_it != scene.layers.end()) {
        scene.layers.erase(layer_it);
    }
    m_applied = false;
}

bool EditorCoordinator::duplicateSceneLayer(const std::string &layer_id,
                                            std::string &out_new_layer_id,
                                            std::string &error_message)
{
    out_new_layer_id.clear();
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneDef *scene = activeScene();
    if (!scene) {
        error_message = "No active scene";
        return false;
    }
    if (layer_id.empty()) {
        error_message = "Empty layer id";
        return false;
    }
    if (!sceneContainsLayer(*scene, layer_id)) {
        error_message = "Layer not found";
        return false;
    }

    SceneId scene_id = m_doc.activeSceneId;
    if (m_doc.scenes.find(scene_id) == m_doc.scenes.end()) {
        scene_id = scene->id.empty() ? m_doc.scenes.begin()->first : scene->id;
    }
    auto cmd = std::make_unique<DuplicateSceneLayerCommand>(scene_id, layer_id);
    DuplicateSceneLayerCommand *raw = cmd.get();
    m_commands.execute(std::move(cmd), m_doc);
    if (!raw->applied() || raw->newLayerId().empty()) {
        error_message = "Failed to duplicate layer";
        return false;
    }
    out_new_layer_id = raw->newLayerId();
    m_active_layer_id = out_new_layer_id;
    bumpRevision();
    return true;
}

} // namespace ArtCade::EditorCore
