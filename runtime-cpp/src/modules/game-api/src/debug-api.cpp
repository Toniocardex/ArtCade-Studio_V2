#include "../include/game-api.h"
#include "../../renderer/include/renderer.h"

#include <sol/sol.hpp>
#include <iostream>

namespace ArtCade::Modules {

void GameAPI::bindDebugAPI(sol::state& lua) {
    auto* renderer = ctx_.renderer;

    lua.set_function("debug_log", [](const std::string& msg) {
        std::cout << "[Lua] " << msg << std::endl;  // endl flushes, ensuring capture in redirected stdout
    });

    lua.set_function("debug_drawLine",
        [renderer](float x1, float y1, float x2, float y2, const std::string& color) {
            // Simple color parsing: "red", "green", "blue", "#RRGGBB"
            Vec4 c = {1.f, 1.f, 1.f, 1.f};
            if      (color == "red")   c = {1.f, 0.f, 0.f, 1.f};
            else if (color == "green") c = {0.f, 1.f, 0.f, 1.f};
            else if (color == "blue")  c = {0.f, 0.f, 1.f, 1.f};
            else if (color == "white") c = {1.f, 1.f, 1.f, 1.f};
            else if (color == "black") c = {0.f, 0.f, 0.f, 1.f};
            renderer->drawLine(x1, y1, x2, y2, c);
        });

    lua.set_function("debug_drawRect",
        [renderer](float x, float y, float w, float h, const std::string& color) {
            Vec4 c = {1.f, 1.f, 0.f, 0.7f};
            if      (color == "red")     c = {1.f, 0.2f, 0.2f, 0.85f};
            else if (color == "green")   c = {0.2f, 1.f, 0.2f, 0.85f};
            else if (color == "blue")    c = {0.2f, 0.5f, 1.f, 0.85f};
            else if (color == "white")   c = {1.f,  1.f,  1.f, 0.85f};
            else if (color == "black")   c = {0.f,  0.f,  0.f, 0.85f};
            else if (color == "yellow")  c = {1.f,  1.f,  0.f, 0.7f};
            else if (color == "cyan")    c = {0.f,  1.f,  1.f, 0.7f};
            else if (color == "magenta") c = {1.f,  0.f,  1.f, 0.7f};
            else if (color == "orange")  c = {1.f,  0.6f, 0.f, 0.85f};
            renderer->drawRect(x, y, w, h, c);
        });

    lua.script(R"(
        debug = {}
        debug.log      = function(msg)                    return debug_log(msg)                         end
        debug.drawLine = function(x1, y1, x2, y2, color) return debug_drawLine(x1,y1,x2,y2,color or "white") end
        debug.drawRect = function(x, y, w, h, color)     return debug_drawRect(x,y,w,h,color or "yellow")    end
    )");
}

} // namespace ArtCade::Modules
