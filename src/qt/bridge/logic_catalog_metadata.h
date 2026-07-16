/**
 * Presentation metadata for Logic registry categories and requirements.
 * This is bridge-only data derived from immutable Logic descriptors.
 */
#pragma once

#include "logic-core.h"

#include <QString>
#include <QStringList>

namespace ArtCade::QtBridge {

/** Maps a stable registry category id to its user-facing label. */
[[nodiscard]] QString logic_catalog_category_label(const QString &category_id);
/** Returns the presentation order for the categories of a catalog @p kind. */
[[nodiscard]] QStringList logic_catalog_preferred_category_order(const QString &kind);
/** Converts a QML catalog kind to the corresponding registry enum. */
[[nodiscard]] Logic::BlockKind logic_catalog_parse_kind(const QString &kind);
/** Maps a required component enum to its user-facing label. */
[[nodiscard]] QString logic_catalog_component_label(Logic::LogicRequiredComponent component);
/** Maps a required context capability enum to its user-facing label. */
[[nodiscard]] QString logic_catalog_capability_label(Logic::LogicContextCapability capability);

} // namespace ArtCade::QtBridge
