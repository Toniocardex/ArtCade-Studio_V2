#include "editor-native/app/asset_import.h"

#include "editor-native/app/editor_coordinator.h"
#include "editor-native/commands/image_asset_commands.h"

#include <algorithm>
#include <array>
#include <cctype>
#include <string>
#include <system_error>

namespace ArtCade::EditorNative {

namespace {

std::string toLower(std::string s) {
    std::transform(s.begin(), s.end(), s.begin(),
                   [](unsigned char c) { return static_cast<char>(std::tolower(c)); });
    return s;
}

bool isSupportedImage(const std::string& extLower) {
    static constexpr std::array<const char*, 4> kImageExt{".png", ".jpg", ".jpeg", ".webp"};
    return std::find(kImageExt.begin(), kImageExt.end(), extLower) != kImageExt.end();
}

// Copy the source into <projectRoot>/assets/images with a name unique against
// both the folder and the catalog (one suffix keeps file name and AssetId in
// step), then record it via the typed command. Rolls the copy back on failure.
ImportAssetResult importImageAsset(EditorCoordinator& coordinator,
                                   const std::filesystem::path& projectRoot,
                                   const std::filesystem::path& source) {
    const std::string ext = toLower(source.extension().string());
    if (!isSupportedImage(ext)) {
        return ImportAssetResult::failure("Unsupported image format: " + ext);
    }

    const std::filesystem::path imagesDir = projectRoot / "assets" / "images";
    std::error_code ec;
    std::filesystem::create_directories(imagesDir, ec);
    if (ec) return ImportAssetResult::failure("Could not create assets/images: " + ec.message());

    const std::string stem = source.stem().string();
    const std::string ext0 = source.extension().string();   // keep original case on disk
    std::string fileName = stem + ext0;
    AssetId     assetId = stem;
    for (int n = 2; std::filesystem::exists(imagesDir / fileName)
                    || coordinator.document().hasImageAsset(assetId); ++n) {
        fileName = stem + "_" + std::to_string(n) + ext0;
        assetId = stem + "_" + std::to_string(n);
    }

    const std::filesystem::path dest = imagesDir / fileName;
    std::filesystem::copy_file(source, dest, ec);
    if (ec) return ImportAssetResult::failure("Could not copy image: " + ec.message());

    const std::string relPath = "assets/images/" + fileName;
    const EditorOperationResult result =
        coordinator.execute(AddImageAssetCommand{assetId, relPath});
    if (!result.ok) {
        std::filesystem::remove(dest, ec);   // roll back the copied file
        return ImportAssetResult::failure("Import failed: " + result.error);
    }
    return ImportAssetResult::success(assetId);
}

} // namespace

ImportAssetResult importAsset(EditorCoordinator& coordinator,
                              const std::filesystem::path& projectRoot,
                              const ImportAssetRequest& request) {
    if (coordinator.isPlaying()) {
        return ImportAssetResult::failure("Stop Play before importing assets");
    }
    if (projectRoot.empty()) {
        return ImportAssetResult::failure("Save the project before importing assets");
    }
    std::error_code ec;
    if (!std::filesystem::is_regular_file(request.sourcePath, ec)) {
        return ImportAssetResult::failure("Source file not found");
    }

    switch (request.kind) {
        case AssetKind::Image: return importImageAsset(coordinator, projectRoot, request.sourcePath);
        case AssetKind::Audio: return ImportAssetResult::failure("Audio import not supported yet");
        case AssetKind::Font:  return ImportAssetResult::failure("Font import not supported yet");
    }
    return ImportAssetResult::failure("Unknown asset kind");
}

} // namespace ArtCade::EditorNative
