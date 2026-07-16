#include "artcade/editor_core/editor_core.h"

#include "logic_board_names.h"

#include "logic-core.h"

#include <algorithm>
namespace ArtCade::EditorCore {

namespace {

bool ensure_logic_block_available(const EntityDef &owner,
                                  const ArtCade::Logic::LogicBlockDescriptor &candidate,
                                  const ArtCade::Logic::LogicBlockDescriptor *trigger,
                                  std::string &error_message)
{
    const ArtCade::Logic::LogicBlockAvailability availability =
        ArtCade::Logic::blockAvailability(owner, candidate, trigger);
    if (availability.compatible) {
        return true;
    }
    error_message = availability.reason;
    return false;
}

bool ensure_trigger_preserves_rule_compatibility(const EntityDef &owner,
                                                 const LogicRuleDef &rule,
                                                 const ArtCade::Logic::LogicBlockDescriptor &trigger,
                                                 std::string &error_message)
{
    for (const LogicBlockDef &block : rule.conditions) {
        const auto *descriptor = ArtCade::Logic::findDescriptor(block.typeId);
        if (descriptor && !ensure_logic_block_available(owner, *descriptor, &trigger, error_message)) {
            return false;
        }
    }
    for (const LogicBlockDef &block : rule.actions) {
        const auto *descriptor = ArtCade::Logic::findDescriptor(block.typeId);
        if (descriptor && !ensure_logic_block_available(owner, *descriptor, &trigger, error_message)) {
            return false;
        }
    }
    return true;
}

} // namespace

bool EditorCoordinator::openProject(const std::string &project_json_path, std::string &error_message)
{
    ProjectDoc loaded;
    if (!project_file_io_load(project_json_path, loaded, error_message)) {
        return false;
    }
    m_doc = std::move(loaded);
    m_path = project_json_path;
    m_has_project = true;
    m_revision = 0;
    m_saved_revision = 0;
    m_selected_entity_id = 0;
    m_active_layer_id.clear();
    m_commands.clear();
    if (!m_doc.layers.empty()) {
        m_active_layer_id = m_doc.layers.front().id;
    }
    return true;
}

bool EditorCoordinator::createNewProject(const std::string &project_json_path,
                                         const std::string &project_name,
                                         std::string &error_message)
{
    if (project_json_path.empty()) {
        error_message = "Project path is empty";
        return false;
    }

    ProjectDoc doc;
    doc.formatVersion = kCurrentProjectFormatVersion;
    doc.projectName = project_name.empty() ? "Untitled" : project_name;
    doc.version = "1.0.0";
    doc.targetFPS = 60.f;
    doc.mainScriptPath = "scripts/main.lua";
    doc.activeSceneId = "scene_main";

    SceneLayerDef layer;
    layer.id = "layer_main";
    layer.name = "Main";
    doc.layers.push_back(layer);

    SceneDef scene;
    scene.id = "scene_main";
    scene.name = "Main Scene";
    scene.backgroundColor = {0.082f, 0.09f, 0.11f, 1.f};
    doc.scenes[scene.id] = std::move(scene);

    if (!project_file_io_save(project_json_path, doc, error_message)) {
        return false;
    }
    return openProject(project_json_path, error_message);
}

bool EditorCoordinator::saveProject(std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (m_path.empty()) {
        error_message = "No project path; use saveProjectAs";
        return false;
    }
    return saveProjectAs(m_path, error_message);
}

bool EditorCoordinator::saveProjectAs(const std::string &project_json_path, std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!project_file_io_save(project_json_path, m_doc, error_message)) {
        return false;
    }
    m_path = project_json_path;
    m_saved_revision = m_revision;
    return true;
}

bool EditorCoordinator::hasProject() const
{
    return m_has_project;
}

const ProjectDoc &EditorCoordinator::document() const
{
    return m_doc;
}

ProjectDoc &EditorCoordinator::document()
{
    return m_doc;
}

const std::string &EditorCoordinator::projectPath() const
{
    return m_path;
}

std::uint64_t EditorCoordinator::revision() const
{
    return m_revision;
}

std::uint64_t EditorCoordinator::savedRevision() const
{
    return m_saved_revision;
}

bool EditorCoordinator::isDirty() const
{
    return m_has_project && m_revision != m_saved_revision;
}

void EditorCoordinator::selectEntity(EntityId entity_id)
{
    m_selected_entity_id = entity_id;
}

void EditorCoordinator::clearSelection()
{
    m_selected_entity_id = 0;
}

EntityId EditorCoordinator::selectedEntityId() const
{
    return m_selected_entity_id;
}

void EditorCoordinator::setActiveLayerId(const std::string &layer_id)
{
    m_active_layer_id = layer_id;
}

const std::string &EditorCoordinator::activeLayerId() const
{
    return m_active_layer_id;
}

void EditorCoordinator::bumpRevision()
{
    ++m_revision;
}

SceneDef *EditorCoordinator::activeScene()
{
    if (!m_has_project || m_doc.scenes.empty()) {
        return nullptr;
    }
    auto it = m_doc.scenes.find(m_doc.activeSceneId);
    if (it != m_doc.scenes.end()) {
        return &it->second;
    }
    return &m_doc.scenes.begin()->second;
}

const SceneDef *EditorCoordinator::activeScene() const
{
    return const_cast<EditorCoordinator *>(this)->activeScene();
}

bool EditorCoordinator::layerVisible(const std::string &layer_id) const
{
    if (layer_id.empty()) {
        return true;
    }
    const SceneDef *scene = activeScene();
    if (!scene) {
        return true;
    }
    auto it = scene->layerSettings.find(layer_id);
    if (it == scene->layerSettings.end()) {
        return true;
    }
    return it->second.visible;
}

bool EditorCoordinator::layerLocked(const std::string &layer_id) const
{
    if (layer_id.empty()) {
        return false;
    }
    for (const SceneLayerDef &layer : m_doc.layers) {
        if (layer.id == layer_id) {
            return layer.locked;
        }
    }
    return false;
}

EntityId EditorCoordinator::pickEntityAt(float world_x, float world_y) const
{
    const SceneDef *scene = activeScene();
    if (!scene) {
        return 0;
    }
    // AABB pick uses scaled placeholder size only (not rotation). Visual paint may
    // rotate; hit-testing stays axis-aligned for this MVP — no OBB.
    // Topmost = last instance in authoring order that contains the point.
    for (auto it = scene->instances.rbegin(); it != scene->instances.rend(); ++it) {
        const SceneInstanceDef &inst = *it;
        if (!inst.visible) {
            continue;
        }
        if (!inst.layerId.empty()) {
            if (!layerVisible(inst.layerId) || layerLocked(inst.layerId)) {
                continue;
            }
        }
        const float w = kSceneViewPlaceholderExtent * inst.transform.scale.x;
        const float h = kSceneViewPlaceholderExtent * inst.transform.scale.y;
        const float left = inst.transform.position.x;
        const float top = inst.transform.position.y;
        if (world_x >= left && world_x <= left + w && world_y >= top && world_y <= top + h) {
            return inst.id;
        }
    }
    return 0;
}

EntityId EditorCoordinator::pickEntityInRect(float x0, float y0, float x1, float y1) const
{
    const SceneDef *scene = activeScene();
    if (!scene) {
        return 0;
    }
    const float left = std::min(x0, x1);
    const float right = std::max(x0, x1);
    const float top = std::min(y0, y1);
    const float bottom = std::max(y0, y1);

    for (auto it = scene->instances.rbegin(); it != scene->instances.rend(); ++it) {
        const SceneInstanceDef &inst = *it;
        if (!inst.visible) {
            continue;
        }
        if (!inst.layerId.empty()) {
            if (!layerVisible(inst.layerId) || layerLocked(inst.layerId)) {
                continue;
            }
        }
        const float w = kSceneViewPlaceholderExtent * inst.transform.scale.x;
        const float h = kSceneViewPlaceholderExtent * inst.transform.scale.y;
        const float il = inst.transform.position.x;
        const float itop = inst.transform.position.y;
        const float ir = il + w;
        const float ib = itop + h;
        const bool overlaps = !(ir < left || il > right || ib < top || itop > bottom);
        if (overlaps) {
            return inst.id;
        }
    }
    return 0;
}

bool EditorCoordinator::renameEntity(EntityId entity_id,
                                     const std::string &new_name,
                                     std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    SceneInstanceDef *inst = project_doc_find_instance(m_doc, entity_id);
    if (!inst) {
        error_message = "Entity not found";
        return false;
    }
    if (inst->instanceName == new_name) {
        return true; // no-op — do not dirty or push undo
    }
    m_commands.execute(std::make_unique<RenameEntityCommand>(entity_id, new_name), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setEntityPosition(EntityId entity_id,
                                          float x,
                                          float y,
                                          std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!is_finite_float(x) || !is_finite_float(y)) {
        error_message = "Position must be finite";
        return false;
    }
    SceneInstanceDef *inst = project_doc_find_instance(m_doc, entity_id);
    if (!inst) {
        error_message = "Entity not found";
        return false;
    }
    if (nearly_equal(inst->transform.position.x, x) && nearly_equal(inst->transform.position.y, y)) {
        return true; // no-op — do not dirty or push undo
    }
    m_commands.execute(std::make_unique<SetEntityPositionCommand>(entity_id, x, y), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setEntityScale(const SceneId &scene_id,
                                       EntityId entity_id,
                                       float scale_x,
                                       float scale_y,
                                       std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    const Vec2 next{scale_x, scale_y};
    if (!is_valid_authored_scale(next)) {
        error_message = "Scale must be finite and greater than zero";
        return false;
    }
    SceneInstanceDef *inst = project_doc_find_instance_in_scene(m_doc, scene_id, entity_id);
    if (!inst) {
        error_message = "Entity not found in scene";
        return false;
    }
    if (nearly_equal(inst->transform.scale, next)) {
        return true; // no-op
    }
    m_commands.execute(std::make_unique<SetEntityScaleCommand>(scene_id, entity_id, next), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setEntityRotation(const SceneId &scene_id,
                                          EntityId entity_id,
                                          float radians,
                                          std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (!is_finite_float(radians)) {
        error_message = "Rotation must be finite";
        return false;
    }
    SceneInstanceDef *inst = project_doc_find_instance_in_scene(m_doc, scene_id, entity_id);
    if (!inst) {
        error_message = "Entity not found in scene";
        return false;
    }
    if (nearly_equal(inst->transform.rotation, radians)) {
        return true; // no-op
    }
    m_commands.execute(
        std::make_unique<SetEntityRotationCommand>(scene_id, entity_id, radians), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLayerVisible(const std::string &layer_id,
                                        bool visible,
                                        std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (layer_id.empty()) {
        error_message = "Empty layer id";
        return false;
    }
    bool known = false;
    for (const SceneLayerDef &layer : m_doc.layers) {
        if (layer.id == layer_id) {
            known = true;
            break;
        }
    }
    if (!known) {
        error_message = "Layer not found";
        return false;
    }
    if (!activeScene()) {
        error_message = "No active scene";
        return false;
    }
    SceneId scene_id;
    auto scene_it = m_doc.scenes.find(m_doc.activeSceneId);
    if (scene_it != m_doc.scenes.end()) {
        scene_id = scene_it->first;
    } else {
        scene_id = m_doc.scenes.begin()->first;
    }
    if (layerVisible(layer_id) == visible) {
        return true; // no-op — do not dirty or push undo
    }
    m_commands.execute(
        std::make_unique<SetLayerVisibleCommand>(scene_id, layer_id, visible), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::addLogicRule(const ObjectTypeId &object_type_id,
                                     LogicRuleId &out_rule_id,
                                     std::string &error_message)
{
    out_rule_id.clear();
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty()) {
        error_message = "Empty object type id";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end()) {
        error_message = "Object type not found";
        return false;
    }
    if (type_it->second.logicBoard
        && type_it->second.logicBoard->rules.size() >= ArtCade::Logic::kMaxRulesPerBoard) {
        error_message = "Logic Board rule limit reached";
        return false;
    }
    auto command = std::make_unique<AddLogicRuleCommand>(object_type_id);
    command->execute(m_doc);
    out_rule_id = command->ruleId();
    if (!command->applied() || out_rule_id.empty()) {
        error_message = "Failed to add Logic rule";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::removeLogicRule(const ObjectTypeId &object_type_id,
                                        const LogicRuleId &rule_id,
                                        std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty()) {
        error_message = "Empty object type id";
        return false;
    }
    if (rule_id.empty()) {
        error_message = "Empty rule id";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end()) {
        error_message = "Object type not found";
        return false;
    }
    if (!type_it->second.logicBoard) {
        error_message = "Object type has no Logic Board";
        return false;
    }
    bool found = false;
    for (const LogicRuleDef &rule : type_it->second.logicBoard->rules) {
        if (rule.id == rule_id) {
            found = true;
            break;
        }
    }
    if (!found) {
        error_message = "Logic rule not found";
        return false;
    }
    m_commands.execute(std::make_unique<RemoveLogicRuleCommand>(object_type_id, rule_id), m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::renameLogicRule(const ObjectTypeId &object_type_id,
                                        const LogicRuleId &rule_id,
                                        const std::string &new_name,
                                        std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty()) {
        error_message = "Missing Logic rule target";
        return false;
    }
    const std::string trimmed = logic_rule_trim_name(new_name);
    if (trimmed.empty()) {
        error_message = "Logic name cannot be empty";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicBoardDef &board = *type_it->second.logicBoard;
    LogicRuleDef *target = nullptr;
    for (std::size_t index = 0; index < board.rules.size(); ++index) {
        LogicRuleDef &candidate = board.rules[index];
        if (candidate.id == rule_id) {
            target = &candidate;
            continue;
        }
        if (logic_rule_normalize_name(logic_rule_display_name(candidate, index))
            == logic_rule_normalize_name(trimmed)) {
            error_message = "A Logic item with this name already exists";
            return false;
        }
    }
    if (!target) {
        error_message = "Logic rule not found";
        return false;
    }
    if (target->name == trimmed) {
        return true; // no-op â€” do not dirty
    }
    auto command = std::make_unique<RenameLogicRuleCommand>(object_type_id, rule_id, trimmed);
    command->execute(m_doc);
    if (target->name != trimmed) {
        error_message = "Failed to rename Logic rule";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLogicRuleTrigger(const ObjectTypeId &object_type_id,
                                            const LogicRuleId &rule_id,
                                            const std::string &block_type_id,
                                            std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty() || block_type_id.empty()) {
        error_message = "Missing Logic Board target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : type_it->second.logicBoard->rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    if (rule->trigger.typeId == block_type_id) {
        return true; // no-op — do not dirty
    }
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(block_type_id);
    if (!desc || desc->kind != ArtCade::Logic::BlockKind::Trigger) {
        error_message = "Not a valid trigger block type";
        return false;
    }
    if (!ensure_logic_block_available(type_it->second, *desc, nullptr, error_message)
        || !ensure_trigger_preserves_rule_compatibility(type_it->second, *rule, *desc,
                                                        error_message)) {
        return false;
    }
    auto command = std::make_unique<SetLogicRuleTriggerCommand>(
        object_type_id, rule_id, block_type_id);
    command->execute(m_doc);
    if (rule->trigger.typeId != block_type_id) {
        error_message = "Failed to set trigger";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLogicRulePrimaryAction(const ObjectTypeId &object_type_id,
                                                  const LogicRuleId &rule_id,
                                                  const std::string &block_type_id,
                                                  std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty() || block_type_id.empty()) {
        error_message = "Missing Logic Board target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : type_it->second.logicBoard->rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    if (!rule->actions.empty() && rule->actions.front().typeId == block_type_id) {
        return true; // no-op — do not dirty
    }
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(block_type_id);
    if (!desc || desc->kind != ArtCade::Logic::BlockKind::Action) {
        error_message = "Not a valid action block type";
        return false;
    }
    const auto *trigger = ArtCade::Logic::findDescriptor(rule->trigger.typeId);
    if (!ensure_logic_block_available(type_it->second, *desc, trigger, error_message)) {
        return false;
    }
    auto command = std::make_unique<SetLogicRulePrimaryActionCommand>(
        object_type_id, rule_id, block_type_id);
    command->execute(m_doc);
    if (rule->actions.empty() || rule->actions.front().typeId != block_type_id) {
        error_message = "Failed to set action";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLogicRuleEnabled(const ObjectTypeId &object_type_id,
                                            const LogicRuleId &rule_id,
                                            bool enabled,
                                            std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty()) {
        error_message = "Missing Logic Board target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : type_it->second.logicBoard->rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    if (rule->enabled == enabled) {
        return true; // no-op — do not dirty
    }
    auto command =
        std::make_unique<SetLogicRuleEnabledCommand>(object_type_id, rule_id, enabled);
    command->execute(m_doc);
    if (rule->enabled != enabled) {
        error_message = "Failed to set rule enabled state";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::addLogicSection(const ObjectTypeId &object_type_id,
                                        const std::string &name,
                                        std::string &out_section_id,
                                        std::string &error_message)
{
    out_section_id.clear();
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty()) {
        error_message = "Empty object type id";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end()) {
        error_message = "Object type not found";
        return false;
    }
    if (type_it->second.logicBoard
        && type_it->second.logicBoard->sections.size()
               >= ArtCade::Logic::kMaxSectionsPerBoard) {
        error_message = "Logic Board section limit reached";
        return false;
    }
    auto command = std::make_unique<AddLogicSectionCommand>(object_type_id, name);
    command->execute(m_doc);
    out_section_id = command->sectionId();
    if (!command->applied() || out_section_id.empty()) {
        error_message = "Failed to add Logic section";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::renameLogicSection(const ObjectTypeId &object_type_id,
                                           const std::string &section_id,
                                           const std::string &new_name,
                                           std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || section_id.empty()) {
        error_message = "Missing Logic section target";
        return false;
    }
    const auto first = new_name.find_first_not_of(" \t");
    if (first == std::string::npos) {
        error_message = "Section name cannot be empty";
        return false;
    }
    const auto last = new_name.find_last_not_of(" \t");
    const std::string trimmed = new_name.substr(first, last - first + 1);
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicSectionDef *section = nullptr;
    for (LogicSectionDef &s : type_it->second.logicBoard->sections) {
        if (s.id == section_id) {
            section = &s;
            break;
        }
    }
    if (!section) {
        error_message = "Logic section not found";
        return false;
    }
    if (section->name == trimmed) {
        return true; // no-op — do not dirty
    }
    auto command =
        std::make_unique<RenameLogicSectionCommand>(object_type_id, section_id, trimmed);
    command->execute(m_doc);
    if (section->name != trimmed) {
        error_message = "Failed to rename Logic section";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::removeLogicSection(const ObjectTypeId &object_type_id,
                                           const std::string &section_id,
                                           std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || section_id.empty()) {
        error_message = "Missing Logic section target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    bool found = false;
    for (const LogicSectionDef &section : type_it->second.logicBoard->sections) {
        if (section.id == section_id) {
            found = true;
            break;
        }
    }
    if (!found) {
        error_message = "Logic section not found";
        return false;
    }
    m_commands.execute(std::make_unique<RemoveLogicSectionCommand>(object_type_id, section_id),
                       m_doc);
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLogicRuleSection(const ObjectTypeId &object_type_id,
                                            const LogicRuleId &rule_id,
                                            const std::string &section_id,
                                            std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty()) {
        error_message = "Missing Logic Board target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicBoardDef &board = *type_it->second.logicBoard;
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : board.rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    if (!section_id.empty()) {
        bool section_found = false;
        for (const LogicSectionDef &section : board.sections) {
            if (section.id == section_id) {
                section_found = true;
                break;
            }
        }
        if (!section_found) {
            error_message = "Logic section not found";
            return false;
        }
    }
    if (rule->sectionId == section_id) {
        return true; // no-op — do not dirty
    }
    auto command =
        std::make_unique<SetLogicRuleSectionCommand>(object_type_id, rule_id, section_id);
    command->execute(m_doc);
    if (rule->sectionId != section_id) {
        error_message = "Failed to set rule section";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLogicRulePrimaryCondition(const ObjectTypeId &object_type_id,
                                                     const LogicRuleId &rule_id,
                                                     const std::string &block_type_id,
                                                     std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty() || block_type_id.empty()) {
        error_message = "Missing Logic Board target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : type_it->second.logicBoard->rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    if (!rule->conditions.empty() && rule->conditions.front().typeId == block_type_id) {
        return true; // no-op — do not dirty
    }
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(block_type_id);
    if (!desc || desc->kind != ArtCade::Logic::BlockKind::Condition) {
        error_message = "Not a valid condition block type";
        return false;
    }
    const auto *trigger = ArtCade::Logic::findDescriptor(rule->trigger.typeId);
    if (!ensure_logic_block_available(type_it->second, *desc, trigger, error_message)) {
        return false;
    }
    auto command = std::make_unique<SetLogicRulePrimaryConditionCommand>(
        object_type_id, rule_id, block_type_id);
    command->execute(m_doc);
    if (rule->conditions.empty() || rule->conditions.front().typeId != block_type_id) {
        error_message = "Failed to set condition";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::clearLogicRuleConditions(const ObjectTypeId &object_type_id,
                                                 const LogicRuleId &rule_id,
                                                 std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty()) {
        error_message = "Missing Logic Board target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : type_it->second.logicBoard->rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    if (rule->conditions.empty()) {
        return true; // no-op — do not dirty
    }
    auto command =
        std::make_unique<ClearLogicRuleConditionsCommand>(object_type_id, rule_id);
    command->execute(m_doc);
    if (!rule->conditions.empty()) {
        error_message = "Failed to clear conditions";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::setLogicRuleBlockProperty(const ObjectTypeId &object_type_id,
                                                  const LogicRuleId &rule_id,
                                                  LogicRuleBlockSlot slot,
                                                  const std::string &property_key,
                                                  const std::string &value_text,
                                                  std::string &error_message)
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    if (object_type_id.empty() || rule_id.empty() || property_key.empty()) {
        error_message = "Missing Logic Board property target";
        return false;
    }
    auto type_it = m_doc.objectTypes.find(object_type_id);
    if (type_it == m_doc.objectTypes.end() || !type_it->second.logicBoard) {
        error_message = "Logic Board not found";
        return false;
    }
    LogicRuleDef *rule = nullptr;
    for (LogicRuleDef &r : type_it->second.logicBoard->rules) {
        if (r.id == rule_id) {
            rule = &r;
            break;
        }
    }
    if (!rule) {
        error_message = "Logic rule not found";
        return false;
    }
    const LogicBlockDef *block = nullptr;
    switch (slot) {
    case LogicRuleBlockSlot::Trigger:
        block = &rule->trigger;
        break;
    case LogicRuleBlockSlot::PrimaryCondition:
        if (rule->conditions.empty()) {
            error_message = "No condition block to edit";
            return false;
        }
        block = &rule->conditions.front();
        break;
    case LogicRuleBlockSlot::PrimaryAction:
        if (rule->actions.empty()) {
            error_message = "No action block to edit";
            return false;
        }
        block = &rule->actions.front();
        break;
    }
    if (!block || block->typeId.empty()) {
        error_message = "Logic block not found";
        return false;
    }
    const ArtCade::Logic::LogicBlockDescriptor *desc =
        ArtCade::Logic::findDescriptor(block->typeId);
    if (!desc) {
        error_message = "Unknown Logic block type";
        return false;
    }
    const ArtCade::Logic::LogicPropertyDescriptor *prop_desc = nullptr;
    for (const ArtCade::Logic::LogicPropertyDescriptor &candidate : desc->properties) {
        if (candidate.key == property_key) {
            prop_desc = &candidate;
            break;
        }
    }
    if (!prop_desc) {
        error_message = "Unknown property on this block";
        return false;
    }
    LogicValue parsed;
    if (!logic_value_parse(prop_desc->valueKind, value_text, parsed, error_message)) {
        return false;
    }
    if (const LogicPropertyDef *current = ArtCade::Logic::findProperty(*block, property_key)) {
        if (logic_values_equal(current->value, parsed)) {
            return true; // no-op — do not dirty
        }
    }
    auto command = std::make_unique<SetLogicRuleBlockPropertyCommand>(
        object_type_id, rule_id, slot, property_key, parsed);
    command->execute(m_doc);
    const LogicPropertyDef *after = ArtCade::Logic::findProperty(*block, property_key);
    if (!after || !logic_values_equal(after->value, parsed)) {
        error_message = "Failed to set property";
        return false;
    }
    m_commands.pushExecuted(std::move(command));
    bumpRevision();
    return true;
}

bool EditorCoordinator::validateLogicForPlay(std::string &error_message) const
{
    if (!m_has_project) {
        error_message = "No project open";
        return false;
    }
    const ArtCade::Logic::LogicCompileResult compiled =
        ArtCade::Logic::compileProjectLogic(m_doc);
    if (compiled.ok()) {
        return true;
    }
    for (const ArtCade::Logic::LogicDiagnostic &d : compiled.diagnostics) {
        if (d.severity != ArtCade::Logic::DiagnosticSeverity::Error) {
            continue;
        }
        error_message.clear();
        if (!d.objectTypeId.empty()) {
            error_message += d.objectTypeId;
            error_message += ": ";
        }
        error_message += d.message;
        if (!d.code.empty()) {
            error_message += " [";
            error_message += d.code;
            error_message += "]";
        }
        return false;
    }
    error_message = "Logic Board compile failed";
    return false;
}

bool EditorCoordinator::renameSelected(const std::string &new_name, std::string &error_message)
{
    if (m_selected_entity_id == 0) {
        error_message = "Nothing selected";
        return false;
    }
    return renameEntity(m_selected_entity_id, new_name, error_message);
}

bool EditorCoordinator::setSelectedPosition(float x, float y, std::string &error_message)
{
    if (m_selected_entity_id == 0) {
        error_message = "Nothing selected";
        return false;
    }
    return setEntityPosition(m_selected_entity_id, x, y, error_message);
}

bool EditorCoordinator::setSelectedScale(float scale_x, float scale_y, std::string &error_message)
{
    if (m_selected_entity_id == 0) {
        error_message = "Nothing selected";
        return false;
    }
    SceneId scene_id;
    const SceneInstanceDef *inst = nullptr;
    if (!project_doc_locate_instance(m_doc, m_selected_entity_id, scene_id, inst) || !inst) {
        error_message = "Entity not found";
        return false;
    }
    return setEntityScale(scene_id, m_selected_entity_id, scale_x, scale_y, error_message);
}

bool EditorCoordinator::setSelectedRotation(float radians, std::string &error_message)
{
    if (m_selected_entity_id == 0) {
        error_message = "Nothing selected";
        return false;
    }
    SceneId scene_id;
    const SceneInstanceDef *inst = nullptr;
    if (!project_doc_locate_instance(m_doc, m_selected_entity_id, scene_id, inst) || !inst) {
        error_message = "Entity not found";
        return false;
    }
    return setEntityRotation(scene_id, m_selected_entity_id, radians, error_message);
}

bool EditorCoordinator::canUndo() const
{
    return m_commands.canUndo();
}

bool EditorCoordinator::canRedo() const
{
    return m_commands.canRedo();
}

void EditorCoordinator::undo()
{
    if (!m_commands.canUndo()) {
        return;
    }
    m_commands.undo(m_doc);
    bumpRevision();
}

void EditorCoordinator::redo()
{
    if (!m_commands.canRedo()) {
        return;
    }
    m_commands.redo(m_doc);
    bumpRevision();
}

} // namespace ArtCade::EditorCore
