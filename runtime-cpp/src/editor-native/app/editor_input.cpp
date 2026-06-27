#include "editor-native/app/editor_input.h"

#include <RmlUi/Core/Context.h>
#include <RmlUi/Core/Element.h>
#include <RmlUi/Core/Input.h>

#include <raylib.h>

namespace ArtCade::EditorNative {

namespace {

int currentModifiers() {
    int mod = 0;
    if (IsKeyDown(KEY_LEFT_CONTROL) || IsKeyDown(KEY_RIGHT_CONTROL)) mod |= Rml::Input::KM_CTRL;
    if (IsKeyDown(KEY_LEFT_SHIFT)   || IsKeyDown(KEY_RIGHT_SHIFT))   mod |= Rml::Input::KM_SHIFT;
    if (IsKeyDown(KEY_LEFT_ALT)     || IsKeyDown(KEY_RIGHT_ALT))     mod |= Rml::Input::KM_ALT;
    return mod;
}

// Editing keys that an RML text field needs. Printable characters arrive
// separately via ProcessTextInput (GetCharPressed).
struct KeyPair { int raylib; Rml::Input::KeyIdentifier rml; };
constexpr KeyPair kKeys[] = {
    {KEY_BACKSPACE, Rml::Input::KI_BACK},   {KEY_DELETE, Rml::Input::KI_DELETE},
    {KEY_ENTER,     Rml::Input::KI_RETURN}, {KEY_KP_ENTER, Rml::Input::KI_RETURN},
    {KEY_TAB,       Rml::Input::KI_TAB},
    {KEY_LEFT,      Rml::Input::KI_LEFT},   {KEY_RIGHT, Rml::Input::KI_RIGHT},
    {KEY_UP,        Rml::Input::KI_UP},     {KEY_DOWN,  Rml::Input::KI_DOWN},
    {KEY_HOME,      Rml::Input::KI_HOME},   {KEY_END,   Rml::Input::KI_END},
};

bool focusIsTextField(Rml::Context* context) {
    Rml::Element* focus = context->GetFocusElement();
    if (!focus) return false;
    const Rml::String tag = focus->GetTagName();
    return tag == "input" || tag == "textarea";
}

} // namespace

RmlInputResult pumpRmlInput(Rml::Context* context) {
    RmlInputResult result;
    if (!context) return result;

    const int mod = currentModifiers();

    const bool propagated = context->ProcessMouseMove(GetMouseX(), GetMouseY(), mod);
    result.mouseOverUi = !propagated;

    const int buttons[] = {MOUSE_BUTTON_LEFT, MOUSE_BUTTON_RIGHT, MOUSE_BUTTON_MIDDLE};
    for (int i = 0; i < 3; ++i) {
        if (IsMouseButtonPressed(buttons[i]))  context->ProcessMouseButtonDown(i, mod);
        if (IsMouseButtonReleased(buttons[i])) context->ProcessMouseButtonUp(i, mod);
    }

    const float wheel = GetMouseWheelMove();
    if (wheel != 0.0f) context->ProcessMouseWheel(-wheel, mod);

    for (const KeyPair& key : kKeys) {
        if (IsKeyPressed(key.raylib) || IsKeyPressedRepeat(key.raylib))
            context->ProcessKeyDown(key.rml, mod);
        if (IsKeyReleased(key.raylib))
            context->ProcessKeyUp(key.rml, mod);
    }

    for (int c = GetCharPressed(); c > 0; c = GetCharPressed())
        context->ProcessTextInput(static_cast<Rml::Character>(c));

    result.textFocus = focusIsTextField(context);
    return result;
}

} // namespace ArtCade::EditorNative
