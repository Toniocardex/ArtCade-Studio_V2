#pragma once
// =============================================================================
// entity-json — deserialize EntityDef fields from editor project JSON
// =============================================================================

#include "types.h"

#include <nlohmann/json.hpp>
#include <string>
#include <unordered_map>

namespace ArtCade::ProjectJson {

/**
 * Reads transform, sprite, physics, and all optional gameplay components.
 * Does not modify entity identity fields (id, name, className, tags).
 */
void read_entity_components(const nlohmann::json& entityJson, EntityDef& out);
void read_variable_definitions(const nlohmann::json& raw,
                               std::vector<GameVariableDefinition>& out);

/**
 * Parses a scene entity instance or legacy entities-map entry.
 * @param use_entity_name_fallback  WASM uses Entity_<id> when name is omitted.
 */
void read_entity_instance(const nlohmann::json& entityJson,
                          EntityId fallbackId,
                          EntityDef& out,
                          bool use_entity_name_fallback);

/**
 * Parses a v2 objectTypes / object_types prototype (id = 0).
 */
void read_object_type(const nlohmann::json& typeJson,
                      const std::string& mapKey,
                      EntityDef& out);

/** Parses entities array or id-keyed object map. */
void read_entities_map(const nlohmann::json& doc,
                       std::unordered_map<EntityId, EntityDef>& out,
                       bool use_entity_name_fallback);

/** Parses objectTypes / object_types object map. */
void read_object_types_map(const nlohmann::json& doc,
                            std::unordered_map<std::string, EntityDef>& out);

} // namespace ArtCade::ProjectJson
