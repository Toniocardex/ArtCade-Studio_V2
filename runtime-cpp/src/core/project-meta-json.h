#pragma once
// =============================================================================
// project-meta-json — world, tile palette, tilesets, thumbnails from project JSON
// =============================================================================

#include "types.h"

#include <nlohmann/json.hpp>
#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::ProjectJson {

/** "#RRGGBB" / "#RGB" → Vec4 (0..1). Opaque grey on invalid input. */
Vec4 hex_to_vec4(const std::string& hex);

/** Parses world object fields into @p out (defaults applied when keys are absent). */
void read_world_settings(const nlohmann::json& worldJson, WorldSettings& out);

/** Parses tilePalette / tile_palette array entries with id >= 1. */
void read_tile_palette(const nlohmann::json& doc, std::vector<TilePaletteEntry>& out);

/**
 * Parses one tileset record. @p mapKey is used when assetId is omitted (object map).
 */
void read_tileset_asset(const nlohmann::json& tilesetJson,
                        const std::string& mapKey,
                        TilesetAsset& out);

/** Parses tilesets array or object map. */
void read_tilesets(const nlohmann::json& doc, std::vector<TilesetAsset>& out);

/** Parses thumbnails object map (sceneId → relative path). */
void read_thumbnails(const nlohmann::json& doc,
                     std::unordered_map<SceneId, std::string>& out);

} // namespace ArtCade::ProjectJson
