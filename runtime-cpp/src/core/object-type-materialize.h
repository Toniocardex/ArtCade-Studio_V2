#pragma once

#include "types.h"

#include <string>
#include <unordered_map>

namespace ArtCade {

/** Merge type prototype + instance placement → runtime EntityDef. */
EntityDef materializeInstance(const EntityDef& typeProto,
                              const SceneInstanceDef& instance);

/** When objectTypes + scene.instances are present, rebuild entities + entityIds. */
void materializeProjectEntities(ProjectDoc& doc);

/** Populate spawn templates: objectTypes first, then first entity per class. */
void rebuildClassPrototypes(
    std::unordered_map<std::string, EntityDef>& out,
    const std::unordered_map<std::string, EntityDef>& objectTypes,
    const std::unordered_map<EntityId, EntityDef>& entityDefs);

} // namespace ArtCade
