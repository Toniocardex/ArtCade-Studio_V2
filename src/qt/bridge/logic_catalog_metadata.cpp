#include "bridge/logic_catalog_metadata.h"

namespace ArtCade::QtBridge {

QString logic_catalog_category_label(const QString &category_id)
{
    if (category_id == QLatin1String("system")) return QStringLiteral("System");
    if (category_id == QLatin1String("input")) return QStringLiteral("Input");
    if (category_id == QLatin1String("entity")) return QStringLiteral("Entity");
    if (category_id == QLatin1String("platformer")) return QStringLiteral("Platformer");
    if (category_id == QLatin1String("collision")) return QStringLiteral("Collision");
    if (category_id == QLatin1String("animation")) return QStringLiteral("Animation");
    if (category_id == QLatin1String("audio")) return QStringLiteral("Audio");
    if (category_id == QLatin1String("variables") || category_id == QLatin1String("state")) {
        return QStringLiteral("Variables");
    }
    if (category_id == QLatin1String("time") || category_id == QLatin1String("flow")) {
        return QStringLiteral("Time");
    }
    if (category_id == QLatin1String("messages")) return QStringLiteral("Messages");
    if (category_id == QLatin1String("physics")) return QStringLiteral("Physics");
    if (category_id.isEmpty()) return QStringLiteral("Other");
    QString label = category_id;
    label[0] = label[0].toUpper();
    return label;
}

QStringList logic_catalog_preferred_category_order(const QString &kind)
{
    if (kind == QLatin1String("trigger")) {
        return {QStringLiteral("system"), QStringLiteral("input"),
                QStringLiteral("collision"), QStringLiteral("time"),
                QStringLiteral("flow"), QStringLiteral("messages")};
    }
    if (kind == QLatin1String("condition")) {
        return {QStringLiteral("entity"), QStringLiteral("platformer"),
                QStringLiteral("collision"), QStringLiteral("input"),
                QStringLiteral("variables"), QStringLiteral("state"),
                QStringLiteral("time"), QStringLiteral("flow")};
    }
    return {QStringLiteral("entity"), QStringLiteral("platformer"),
            QStringLiteral("animation"), QStringLiteral("audio"),
            QStringLiteral("physics"), QStringLiteral("variables"),
            QStringLiteral("state"), QStringLiteral("time"),
            QStringLiteral("flow"), QStringLiteral("messages")};
}

Logic::BlockKind logic_catalog_parse_kind(const QString &kind)
{
    if (kind == QLatin1String("trigger")) return Logic::BlockKind::Trigger;
    if (kind == QLatin1String("condition")) return Logic::BlockKind::Condition;
    return Logic::BlockKind::Action;
}

QString logic_catalog_capability_label(Logic::LogicContextCapability capability)
{
    using Cap = Logic::LogicContextCapability;
    switch (capability) {
    case Cap::Self: return QStringLiteral("Self");
    case Cap::EventOther: return QStringLiteral("Event Other");
    case Cap::DeltaTime: return QStringLiteral("Delta Time");
    case Cap::CollisionContact: return QStringLiteral("Collision Contact");
    case Cap::MessagePayload: return QStringLiteral("Message Payload");
    }
    return QStringLiteral("Context");
}

} // namespace ArtCade::QtBridge
