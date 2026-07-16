#include "artcade/editor_core/editor_core.h"

namespace ArtCade::EditorCore {
namespace {

EntityDef *find_object_type(ProjectDoc &doc, const ObjectTypeId &object_type_id)
{
    if (object_type_id.empty()) {
        return nullptr;
    }
    auto type_it = doc.objectTypes.find(object_type_id);
    if (type_it == doc.objectTypes.end()) {
        return nullptr;
    }
    return &type_it->second;
}

bool sprite_animator_complete(const EntityDef &type)
{
    return type.spriteRenderer.has_value() && type.spriteAnimator.has_value();
}

} // namespace

EnsureObjectTypeComponentCommand::EnsureObjectTypeComponentCommand(ObjectTypeId object_type_id,
                                                                   Logic::LogicRequiredComponent component)
    : m_object_type_id(std::move(object_type_id))
    , m_component(component)
{
}

void EnsureObjectTypeComponentCommand::execute(ProjectDoc &doc)
{
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type) {
        return;
    }
    if (!m_captured) {
        m_had_platformer = type->platformerController.has_value();
        if (m_had_platformer) {
            m_old_platformer = *type->platformerController;
        }
        m_had_sprite_renderer = type->spriteRenderer.has_value();
        if (m_had_sprite_renderer) {
            m_old_sprite_renderer = *type->spriteRenderer;
        }
        m_had_sprite_animator = type->spriteAnimator.has_value();
        if (m_had_sprite_animator) {
            m_old_sprite_animator = *type->spriteAnimator;
        }
        m_captured = true;
    }

    if (m_component == Logic::LogicRequiredComponent::PlatformerController) {
        if (type->platformerController.has_value()) {
            return; // no-op — already present
        }
        type->platformerController = PlatformerControllerComponent{};
        m_applied = true;
        return;
    }
    if (m_component == Logic::LogicRequiredComponent::SpriteAnimator) {
        if (sprite_animator_complete(*type)) {
            return; // no-op — availability already satisfied
        }
        if (!type->spriteRenderer.has_value()) {
            type->spriteRenderer = SpriteRendererComponent{};
        }
        if (!type->spriteAnimator.has_value()) {
            type->spriteAnimator = SpriteAnimatorComponent{};
        }
        m_applied = true;
        return;
    }
}

void EnsureObjectTypeComponentCommand::undo(ProjectDoc &doc)
{
    if (!m_applied) {
        return;
    }
    EntityDef *type = find_object_type(doc, m_object_type_id);
    if (!type) {
        return;
    }
    if (m_component == Logic::LogicRequiredComponent::PlatformerController) {
        if (m_had_platformer) {
            type->platformerController = m_old_platformer;
        } else {
            type->platformerController.reset();
        }
        return;
    }
    if (m_component == Logic::LogicRequiredComponent::SpriteAnimator) {
        if (m_had_sprite_renderer) {
            type->spriteRenderer = m_old_sprite_renderer;
        } else {
            type->spriteRenderer.reset();
        }
        if (m_had_sprite_animator) {
            type->spriteAnimator = m_old_sprite_animator;
        } else {
            type->spriteAnimator.reset();
        }
    }
}

} // namespace ArtCade::EditorCore
