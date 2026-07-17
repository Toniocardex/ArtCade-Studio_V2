#pragma once

#include "artcade/editor_core/editor_core.h"

#include <string>

namespace ArtCade::EditorCore::SceneLayerSupport {

std::string trim_whitespace(const std::string &value);
bool name_taken_case_insensitive(const SceneDef &scene,
                                 const std::string &name,
                                 const std::string &except_layer_id);
std::string allocate_layer_id(const SceneDef &scene);
std::string next_available_layer_name(const SceneDef &scene);
std::string next_copy_layer_name(const SceneDef &scene, const std::string &base_name);
std::string next_copy_instance_name(const SceneDef &scene, const std::string &base_name);
EntityId allocate_next_entity_id(const ProjectDoc &doc);

} // namespace ArtCade::EditorCore::SceneLayerSupport
