#pragma once
// =============================================================================
// asset-json — deserialize editor image asset library entries from project JSON
// =============================================================================

#include "types.h"

#include <nlohmann/json.hpp>
#include <string>
#include <vector>

namespace ArtCade::ProjectJson {

/**
 * Parses one assets-map entry. @p mapKey is the JSON object key when id/path omitted.
 */
void read_image_asset(const nlohmann::json& assetJson,
                      const std::string& mapKey,
                      ImageAssetDef& out);

/** Parses project.assets object map into image library definitions. */
void read_image_assets(const nlohmann::json& doc, std::vector<ImageAssetDef>& out);

} // namespace ArtCade::ProjectJson
