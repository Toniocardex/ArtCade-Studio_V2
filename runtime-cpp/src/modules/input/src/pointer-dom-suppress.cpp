#include "../include/pointer-dom-suppress.h"

#ifdef __EMSCRIPTEN__
#include <emscripten.h>
#endif

namespace ArtCade::Modules {

void pointerDomSuppressInit(const char* canvasSelector) {
#ifdef __EMSCRIPTEN__
    if (!canvasSelector || !*canvasSelector) return;
    EM_ASM(
        {
            var sel = UTF8ToString($0);
            var el = document.querySelector(sel);
            if (!el || el.__artcadeDomSuppress) return;
            el.__artcadeDomSuppress = true;
            if (typeof window.__artcadePreventMask !== 'number')
                window.__artcadePreventMask = 0;
            var onBlock = function(e) {
                var mask = window.__artcadePreventMask | 0;
                if (!mask) return;
                var bit = e.button === 2 ? 2 : (e.button === 0 ? 1 : 0);
                if (mask & bit) e.preventDefault();
            };
            el.addEventListener('contextmenu', function(e) {
                if ((window.__artcadePreventMask | 0) & 2) e.preventDefault();
            }, true);
            el.addEventListener('mousedown', onBlock, true);
        },
        canvasSelector);
#else
    (void)canvasSelector;
#endif
}

void pointerDomSuppressPublishMask(uint8_t mask) {
#ifdef __EMSCRIPTEN__
    EM_ASM(
        { window.__artcadePreventMask = (window.__artcadePreventMask | 0) | ($0 | 0); },
        static_cast<int>(mask));
#else
    (void)mask;
#endif
}

} // namespace ArtCade::Modules
