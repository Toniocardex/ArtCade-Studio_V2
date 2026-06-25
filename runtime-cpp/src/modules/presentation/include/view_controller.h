#pragma once

#include "presentation_types.h"

namespace ArtCade::Presentation {

/**
 * Owns editor-view navigation intents (pan, zoom-at-cursor, resize).
 * Does not depend on renderer or Raylib.
 */
class ViewController {
public:
    void set_editor_view(EditorViewState view);
    const EditorViewState& editor_view() const { return editorView_; }

    void set_surface_metrics(SurfaceMetrics metrics);
    const SurfaceMetrics& surface_metrics() const { return surface_; }

    void begin_pan(SurfacePoint surface);
    void update_pan(SurfacePoint surface);
    void end_pan();

    /**
     * Cursor-anchored zoom for editor navigation.
     * The world point under @p surface stays fixed after zoom.
     * @param zoomFactor multiplicative factor (must be > 0)
     */
    void zoom_at(SurfacePoint surface, double zoomFactor);

    /** Updates surface metrics only; editor camera world position is preserved. */
    void resize_surface(double cssW, double cssH, double devicePixelRatio);

    /** Phase 2+: frame visible world bounds. No-op stub in Phase 1. */
    void frame_world_bounds(double minX, double minY, double maxX, double maxY);

    /** Phase 2+: reset editor view. No-op stub in Phase 1. */
    void reset_view();

private:
    EditorViewState editorView_{};
    SurfaceMetrics surface_{};

    ViewCamera2D editor_camera() const;
    OutputPlacement editor_placement() const;
};

} // namespace ArtCade::Presentation
