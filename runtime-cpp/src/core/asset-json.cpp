#include "asset-json.h"

#include "json-primitives.h"

namespace ArtCade::ProjectJson {

void read_image_asset(const nlohmann::json& assetJson,
                      const std::string& mapKey,
                      ImageAssetDef& out) {
    if (!assetJson.is_object())
        return;

    out = ImageAssetDef{};
    const std::string libId   = assetJson.value("id", mapKey);
    const std::string libPath = assetJson.value("path", std::string{});
    out.assetId = libPath.empty() ? libId : libPath;
    out.name = assetJson.value("name", libId);

    if (assetJson.contains("imagePoints") && assetJson["imagePoints"].is_array()) {
        for (const auto& pt : assetJson["imagePoints"]) {
            if (!pt.is_object())
                continue;
            ImagePointDef ip;
            ip.id = pt.value("id", std::string{});
            ip.x  = pt.value("x", 0.f);
            ip.y  = pt.value("y", 0.f);
            if (!ip.id.empty())
                out.imagePoints.push_back(ip);
        }
    }

    if (assetJson.contains("defaultPivot"))
        out.defaultPivot = read_vec2(assetJson["defaultPivot"], out.defaultPivot);

    if (assetJson.contains("clips") && assetJson["clips"].is_array()) {
        for (const auto& cv : assetJson["clips"]) {
            if (!cv.is_object())
                continue;
            AnimationClipDef clip;
            clip.name = cv.value("name", std::string{});
            clip.fps  = cv.value("fps", 12.f);
            clip.loop = cv.value("loop", true);
            if (cv.contains("frames") && cv["frames"].is_array()) {
                for (const auto& fr : cv["frames"]) {
                    if (!fr.is_object())
                        continue;
                    AnimationFrameRect rect;
                    rect.x = fr.value("x", 0.f);
                    rect.y = fr.value("y", 0.f);
                    rect.w = fr.value("w", 0.f);
                    rect.h = fr.value("h", 0.f);
                    if (rect.w > 0.f && rect.h > 0.f)
                        clip.frames.push_back(rect);
                }
            }
            if (!clip.name.empty() && !clip.frames.empty())
                out.clips.push_back(std::move(clip));
        }
    }
}

void read_image_assets(const nlohmann::json& doc, std::vector<ImageAssetDef>& out) {
    out.clear();
    if (!doc.contains("assets") || !doc["assets"].is_object())
        return;

    for (auto& [key, av] : doc["assets"].items()) {
        if (!av.is_object())
            continue;
        ImageAssetDef asset;
        read_image_asset(av, key, asset);
        out.push_back(std::move(asset));
    }
}

} // namespace ArtCade::ProjectJson
