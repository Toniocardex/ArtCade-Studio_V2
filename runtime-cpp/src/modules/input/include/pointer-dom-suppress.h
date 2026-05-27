#pragma once

#include <cstdint>

namespace ArtCade::Modules {

/** Register capture-phase DOM listeners on the game canvas (Emscripten only). */
void pointerDomSuppressInit(const char* canvasSelector);

/** Publish the current prevent-default mask to the browser (bit0=left, bit1=right). */
void pointerDomSuppressPublishMask(uint8_t mask);

} // namespace ArtCade::Modules
