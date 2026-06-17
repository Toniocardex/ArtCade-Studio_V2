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

const TilesetAsset* resolveCellTileset(
    const TilemapData& tm,
    int sourceIndex,
    const std::vector<TilesetAsset>& liveTilesets,
    const std::unordered_map<std::string, TilesetAsset>& startupCache)
{
    if (sourceIndex > 0
        && sourceIndex <= static_cast<int>(tm.tilesetSources.size())) {
        return resolveTileset(
            tm.tilesetSources[static_cast<size_t>(sourceIndex - 1)].tilesetAssetId,
            liveTilesets,
            startupCache);
    }
    if (!tm.tilesetAssetId.empty())
        return resolveTileset(tm.tilesetAssetId, liveTilesets, startupCache);
    return nullptr;
}

int cellSourceIndex(const TilemapData& tm, int idx) {
    if (idx >= 0 && idx < static_cast<int>(tm.sourceIndices.size()))
        return tm.sourceIndices[static_cast<size_t>(idx)];
    if (!tm.tilesetAssetId.empty()) return 1;
    return 0;
}

void drawLayer(Modules::Renderer& renderer,
               const TilemapData& tm,
               const std::vector<TilesetAsset>& liveTilesets,
               const std::unordered_map<std::string, TilesetAsset>& startupCache,
               const std::unordered_map<int, Vec4>& palette)
{
    if (tm.cols <= 0 || tm.rows <= 0) return;

    const int n = static_cast<int>(tm.data.size());

    for (int r = 0; r < tm.rows; ++r) {
        for (int c = 0; c < tm.cols; ++c) {
            const int idx = r * tm.cols + c;
            if (idx >= n) continue;
            const int id = tm.data[idx];
            if (id <= 0) continue;

            const float dx = c * tm.tileSize;
            const float dy = r * tm.tileSize;

            const TilesetAsset* ts = resolveCellTileset(
                tm, cellSourceIndex(tm, idx), liveTilesets, startupCache);

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

} // namespace

void draw(Modules::Renderer& renderer,
          const SceneDef& scene,
          const std::vector<SceneLayerDef>& layerStack,
          const std::vector<TilesetAsset>& liveTilesets,
          const std::unordered_map<std::string, TilesetAsset>& startupCache,
          const std::unordered_map<int, Vec4>& palette)
{
    if (!scene.tilemapLayers.empty() && !layerStack.empty()) {
        for (int i = static_cast<int>(layerStack.size()) - 1; i >= 0; --i) {
            const auto it = scene.tilemapLayers.find(layerStack[static_cast<size_t>(i)].name);
            if (it != scene.tilemapLayers.end())
                drawLayer(renderer, it->second, liveTilesets, startupCache, palette);
        }
        return;
    }

    drawLayer(renderer, scene.tilemap, liveTilesets, startupCache, palette);
}

} // namespace ArtCade::TilemapRenderer
