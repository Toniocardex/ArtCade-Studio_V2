#include "tilemap-renderer.h"

#include "../../modules/renderer/include/renderer.h"

namespace ArtCade::TilemapRenderer {

namespace {

const TilesetAsset* resolveTileset(
    const std::string& assetId,
    const std::vector<TilesetAsset>& liveTilesets,
    const std::unordered_map<std::string, TilesetAsset>& startupCache)
{
    if (assetId.empty()) return nullptr;
    for (const auto& t : liveTilesets) {
        if (t.assetId == assetId) return &t;
    }
    auto it = startupCache.find(assetId);
    return it != startupCache.end() ? &it->second : nullptr;
}

} // namespace

void draw(Modules::Renderer& renderer,
          const SceneDef& scene,
          const std::vector<TilesetAsset>& liveTilesets,
          const std::unordered_map<std::string, TilesetAsset>& startupCache,
          const std::unordered_map<int, Vec4>& palette)
{
    const auto& tm = scene.tilemap;
    if (tm.cols <= 0 || tm.rows <= 0) return;

    const int n = static_cast<int>(tm.data.size());
    const TilesetAsset* ts = resolveTileset(tm.tilesetAssetId, liveTilesets, startupCache);

    for (int r = 0; r < tm.rows; ++r) {
        for (int c = 0; c < tm.cols; ++c) {
            const int idx = r * tm.cols + c;
            if (idx >= n) continue;
            const int id = tm.data[idx];
            if (id <= 0) continue;

            const float dx = c * tm.tileSize;
            const float dy = r * tm.tileSize;

            bool drawn = false;
            if (ts && ts->cols > 0) {
                const int   sCol = (id - 1) % ts->cols;
                const int   sRow = (id - 1) / ts->cols;
                const float step = ts->tileSize + ts->margin;
                drawn = renderer.drawSpriteRegion(
                    ts->spriteImagePath,
                    sCol * step, sRow * step, ts->tileSize, ts->tileSize,
                    dx, dy, tm.tileSize, tm.tileSize);
            }
            if (!drawn) {
                auto it = palette.find(id);
                const Vec4 col = (it != palette.end())
                    ? it->second : Vec4{0.5f, 0.5f, 0.5f, 1.f};
                renderer.drawRect(dx, dy, tm.tileSize, tm.tileSize, col);
            }
        }
    }
}

} // namespace ArtCade::TilemapRenderer
