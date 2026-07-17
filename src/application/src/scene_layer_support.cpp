#include "scene_layer_support.h"

#include <algorithm>
#include <charconv>
#include <cctype>

namespace ArtCade::EditorCore {
namespace {

std::string ascii_lower(std::string value)
{
    for (char &ch : value) {
        ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
    }
    return value;
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

} // namespace

namespace SceneLayerSupport {

std::string trim_whitespace(const std::string &value)
{
    std::size_t begin = 0;
    while (begin < value.size() && std::isspace(static_cast<unsigned char>(value[begin]))) {
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
        if (layer.id != except_layer_id
            && ascii_lower(layer.name.empty() ? layer.id : layer.name) == needle) {
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
        if (parsed.ec == std::errc{} && parsed.ptr == end && n > max_n) {
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
            max_id = std::max(max_id, inst.id);
        }
    }
    return max_id + 1;
}

} // namespace SceneLayerSupport

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
    return const_cast<SceneLayerDef *>(findSceneLayer(static_cast<const SceneDef &>(scene), layer_id));
}

std::size_t EditorCoordinator::sceneLayerIndex(const SceneDef &scene, const std::string &layer_id)
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

} // namespace ArtCade::EditorCore
