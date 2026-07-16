#pragma once

#include "types.h"

#include <cstddef>
#include <string>
#include <string_view>

namespace ArtCade::EditorCore {

/** Removes leading and trailing ASCII whitespace from an authoring Logic name. */
[[nodiscard]] std::string logic_rule_trim_name(std::string_view value);
/** Returns the case-insensitive ASCII comparison key for an authoring Logic name. */
[[nodiscard]] std::string logic_rule_normalize_name(std::string_view value);
/** Returns the persisted name or the stable legacy fallback for a rule at @p index. */
[[nodiscard]] std::string logic_rule_display_name(const LogicRuleDef &rule, std::size_t index);
/** Returns the first free canonical "Logic NN" authoring name for @p board. */
[[nodiscard]] std::string logic_board_next_available_rule_name(const LogicBoardDef &board);

} // namespace ArtCade::EditorCore
