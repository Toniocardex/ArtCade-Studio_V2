#pragma once
// =============================================================================
// entity-json — deserialize EntityDef fields from editor project JSON
// =============================================================================

#include "types.h"

#include <nlohmann/json.hpp>
#include <string>

namespace ArtCade::ProjectJson {

/**
 * Reads transform, sprite, physics, and all optional gameplay components.
 * Does not modify entity identity fields (id, name, className, tags).
 */
void read_entity_components(const nlohmann::json& entityJson, EntityDef& out);

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

} // namespace ArtCade::ProjectJson
