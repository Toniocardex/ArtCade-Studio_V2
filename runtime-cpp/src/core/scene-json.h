#pragma once
// =============================================================================
// scene-json — deserialize SceneDef fields from editor project JSON
// =============================================================================

#include "types.h"

#include <nlohmann/json.hpp>
#include <string>

namespace ArtCade::ProjectJson {

/**
 * Parses a scene placement instance. Returns true when id and objectTypeId are valid.
 */
bool read_scene_instance(const nlohmann::json& instanceJson, SceneInstanceDef& out);

/** Parses tilemap when present; leaves out unchanged when absent or invalid. */
void read_tilemap(const nlohmann::json& sceneJson, TilemapData& out);

/**
 * Parses a single scene object (array entry or scenes-map value).
 * Identity defaults to @p fallbackId when id/name are omitted.
 */
void read_scene_def(const nlohmann::json& sceneJson,
                    const SceneId& fallbackId,
                    SceneDef& out);

} // namespace ArtCade::ProjectJson
