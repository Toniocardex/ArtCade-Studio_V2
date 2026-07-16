#include "logic_board_names.h"

#include <algorithm>
#include <cctype>
#include <vector>

namespace ArtCade::EditorCore {
namespace {

std::string fallback_logic_name(std::size_t index)
{
    const std::string number = std::to_string(index + 1);
    return std::string("Logic ") + (number.size() < 2 ? "0" : "") + number;
}

} // namespace

std::string logic_rule_trim_name(std::string_view value)
{
    const auto first = value.find_first_not_of(" \t");
    if (first == std::string_view::npos) {
        return {};
    }
    const auto last = value.find_last_not_of(" \t");
    return std::string(value.substr(first, last - first + 1));
}

std::string logic_rule_normalize_name(std::string_view value)
{
    std::string normalized = logic_rule_trim_name(value);
    for (char &ch : normalized) {
        ch = static_cast<char>(std::tolower(static_cast<unsigned char>(ch)));
    }
    return normalized;
}

std::string logic_rule_display_name(const LogicRuleDef &rule, std::size_t index)
{
    return rule.name.empty() ? fallback_logic_name(index) : rule.name;
}

std::string logic_board_next_available_rule_name(const LogicBoardDef &board)
{
    std::vector<std::string> existing;
    existing.reserve(board.rules.size());
    for (std::size_t index = 0; index < board.rules.size(); ++index) {
        existing.push_back(logic_rule_normalize_name(
            logic_rule_display_name(board.rules[index], index)));
    }
    for (std::size_t number = 1;; ++number) {
        const std::string digits = std::to_string(number);
        const std::string candidate =
            std::string("Logic ") + (digits.size() < 2 ? "0" : "") + digits;
        if (std::find(existing.begin(), existing.end(), logic_rule_normalize_name(candidate))
            == existing.end()) {
            return candidate;
        }
    }
}

} // namespace ArtCade::EditorCore
