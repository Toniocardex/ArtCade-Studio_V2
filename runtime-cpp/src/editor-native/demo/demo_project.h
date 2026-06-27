#pragma once

#include "core/types.h"

namespace ArtCade::EditorNative {

// An in-memory ProjectDoc so the spike runs without the asset pipeline. The
// viewport renders real SceneDef / SceneInstanceDef data — the same authoring
// types the engine loads from .artcade — just constructed in code.
ProjectDoc makeDemoProject();

} // namespace ArtCade::EditorNative
