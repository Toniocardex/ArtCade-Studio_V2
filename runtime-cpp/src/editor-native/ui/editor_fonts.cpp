#include "editor-native/ui/editor_fonts.h"

#include <RmlUi/Core.h>

#include <array>

namespace ArtCade::EditorNative {
namespace {

struct RequiredFont {
    const char* relativePath;
    const char* label;
    Rml::Style::FontWeight weight;
};

constexpr std::array<RequiredFont, 4> kRequiredFonts{{
    {"fonts/inter/Inter-Regular.ttf",  "Inter Regular",  Rml::Style::FontWeight::Normal},
    {"fonts/inter/Inter-Medium.ttf",   "Inter Medium",   static_cast<Rml::Style::FontWeight>(500)},
    {"fonts/inter/Inter-SemiBold.ttf", "Inter SemiBold", static_cast<Rml::Style::FontWeight>(600)},
    {"fonts/inter/Inter-Bold.ttf",     "Inter Bold",     Rml::Style::FontWeight::Bold},
}};

} // namespace

FontLoadResult loadEditorFonts(const std::filesystem::path& resourceRoot) {
    for (const RequiredFont& font : kRequiredFonts) {
        const std::filesystem::path path = resourceRoot / font.relativePath;
        if (!std::filesystem::exists(path)) {
            return {
                false,
                std::string("Missing required font: ") + font.label +
                    " (" + path.string() + ")"
            };
        }

        if (!Rml::LoadFontFace(path.string(), false, font.weight)) {
            return {
                false,
                std::string("RmlUi failed to load font: ") + font.label +
                    " (" + path.string() + ")"
            };
        }
    }

    return {true, {}};
}

} // namespace ArtCade::EditorNative
