#pragma once

#include "types.h"

#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade {

/** Merge type prototype + instance placement → runtime EntityDef.
 *  `animationAssets` supplies Animation-source sheet ids
 *  (`SpriteAnimationAssetDef::sourceImageAssetId`); see ADR-0010. */
EntityDef materializeInstance(
    const EntityDef& typeProto,
    const SceneInstanceDef& instance,
    const std::vector<SpriteAnimationAssetDef>& animationAssets);

/** When objectTypes + scene.instances are present, rebuild entities + entityIds. */
void materializeProjectEntities(ProjectDoc& doc);

/** Populate spawn templates: objectTypes first, then first entity per class. */
void rebuildClassPrototypes(
    std::unordered_map<std::string, EntityDef>& out,
    const std::unordered_map<std::string, EntityDef>& objectTypes,
    const std::unordered_map<EntityId, EntityDef>& entityDefs);

/** Apply ImageAssetDef.defaultPivot to sprites with pivotFromAsset. */
void resolveSpritePivotsFromImageAssets(ProjectDoc& doc);

} // namespace ArtCade
