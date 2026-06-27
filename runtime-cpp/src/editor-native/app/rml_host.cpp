#include "editor-native/app/rml_host.h"

#include <RmlUi/Core.h>
#include <RmlUi/Debugger.h>

#include <raylib.h>

namespace ArtCade::EditorNative {

namespace {

// Spike shortcut: load system fonts by absolute path so we do not ship a binary
// TTF. A released editor would bundle a libre family (e.g. Inter + JetBrains
// Mono) under resources/fonts and load those instead.
void loadEditorFonts() {
    struct Face { const char* path; bool fallback; };
    const Face faces[] = {
        {"C:/Windows/Fonts/segoeui.ttf",  true},
        {"C:/Windows/Fonts/segoeuib.ttf", false},
        {"C:/Windows/Fonts/consola.ttf",  false},
    };
    for (const Face& face : faces) {
        if (FileExists(face.path)) Rml::LoadFontFace(face.path, face.fallback);
    }
}

} // namespace

bool RmlHost::initialize(int width, int height, float dpRatio,
                         const std::string& documentPath) {
    if (initialized_) return true;

    Rml::SetSystemInterface(&system_);
    Rml::SetRenderInterface(&renderer_);
    if (!Rml::Initialise()) return false;

    loadEditorFonts();

    context_ = Rml::CreateContext("editor", Rml::Vector2i(width, height));
    if (!context_) {
        Rml::Shutdown();
        return false;
    }
    context_->SetDensityIndependentPixelRatio(dpRatio);
    Rml::Debugger::Initialise(context_);

    document_ = context_->LoadDocument(documentPath);
    if (document_) document_->Show();

    initialized_ = true;
    return document_ != nullptr;
}

void RmlHost::resize(int width, int height, float dpRatio) {
    if (!context_) return;
    context_->SetDimensions(Rml::Vector2i(width, height));
    context_->SetDensityIndependentPixelRatio(dpRatio);
}

void RmlHost::update() {
    if (context_) context_->Update();
}

void RmlHost::render() {
    if (!context_) return;
    // RmlUi vertices carry premultiplied alpha; blend accordingly.
    BeginBlendMode(BLEND_ALPHA_PREMULTIPLY);
    context_->Render();
    EndBlendMode();
}

void RmlHost::toggleDebugger() {
    if (!context_) return;
    debugger_ = !debugger_;
    Rml::Debugger::SetVisible(debugger_);
}

void RmlHost::shutdown() {
    if (!initialized_) return;
    Rml::Shutdown();   // releases contexts, documents and textures (via ReleaseTexture)
    context_ = nullptr;
    document_ = nullptr;
    initialized_ = false;
}

} // namespace ArtCade::EditorNative
