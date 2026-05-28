#pragma once
// =============================================================================
// project-doc-parser  -- JSON -> EntityDef / SceneDef / TilesetAsset
// =============================================================================
//
// Extracted from editor-api.cpp during the Phase 5 split (see
// docs/TECHNICAL_DEBT_REVIEW.md). editor_load_project() builds a project
// from a JSON blob; keeping the parsing helpers separate makes the
// command itself short and the parsing surface easy to unit-test in
// isolation.
//
// WASM-only: the parser is part of the editor bridge, which only links in
// the Emscripten build.
// =============================================================================

#ifdef __EMSCRIPTEN__

#include "../../../core/types.h"

#include <nlohmann/json.hpp>

#include <string>
#include <unordered_map>
#include <vector>

namespace ArtCade::ProjectDocParser {

ArtCade::Vec2            parseVec2     (const nlohmann::json& j);
ArtCade::Vec4            parseVec4     (const nlohmann::json& j);
ArtCade::Transform       parseTransform(const nlohmann::json& j);
ArtCade::SpriteComponent parseSprite   (const nlohmann::json& j);

ArtCade::EntityDef       parseEntityDef (const nlohmann::json& j,
                                         ArtCade::EntityId fallbackId);
ArtCade::SceneDef        parseSceneDef  (const nlohmann::json& j,
                                         const ArtCade::SceneId& fallbackId);
ArtCade::TilesetAsset    parseTilesetAsset(const nlohmann::json& j);

/**
 * Top-level helpers for editor_load_project().
 *
 *  - parseEntities() and parseScenes() accept either a JSON array or an
 *    object keyed by id.
 *  - parseTilesets() accepts the same shape.
 */
std::unordered_map<ArtCade::EntityId, ArtCade::EntityDef>
parseEntities(const nlohmann::json& doc);

std::unordered_map<ArtCade::SceneId, ArtCade::SceneDef>
parseScenes(const nlohmann::json& doc);

std::vector<ArtCade::TilesetAsset>
parseTilesets(const nlohmann::json& doc);

std::vector<ArtCade::TilePaletteEntry>
parseTilePalette(const nlohmann::json& doc);

std::unordered_map<std::string, ArtCade::EntityDef>
parseObjectTypes(const nlohmann::json& doc);

/** Merge objectTypes + scene.instances when v2 project has no flat entities map. */
void materializeV2Project(
    std::unordered_map<ArtCade::EntityId, ArtCade::EntityDef>& entities,
    std::unordered_map<ArtCade::SceneId, ArtCade::SceneDef>& scenes,
    const std::unordered_map<std::string, ArtCade::EntityDef>& objectTypes);

/** targetFPS + world.physicsMode from editor_load_project JSON. */
ArtCade::ProjectRuntimeSettings parseRuntimeSettings(const nlohmann::json& doc);

} // namespace ArtCade::ProjectDocParser

#endif // __EMSCRIPTEN__
