#include "app/render/text_value_formatter.h"

#include <cstdint>
#include <iostream>
#include <string>

using ArtCade::AppRender::formatTextValue;
using ArtCade::Modules::VariableManager;

namespace {

bool expectEqual(const std::string& actual,
                 const std::string& expected,
                 const char* label) {
    if (actual == expected) return true;
    std::cerr << label << ": expected \"" << expected
              << "\", got \"" << actual << "\"\n";
    return false;
}

} // namespace

int main() {
    bool ok = true;
    ok &= expectEqual(formatTextValue(VariableManager::Value{int32_t{12}}, "text", 0), "12", "integer text");
    ok &= expectEqual(formatTextValue(VariableManager::Value{12.0f}, "text", 0), "12", "integral float text");
    ok &= expectEqual(formatTextValue(VariableManager::Value{true}, "text", 0), "true", "boolean text");
    ok &= expectEqual(formatTextValue(VariableManager::Value{12.6f}, "integer", 0), "13", "rounded integer");
    ok &= expectEqual(formatTextValue(VariableManager::Value{int32_t{7}}, "padded", 3), "007", "padded integer");
    ok &= expectEqual(formatTextValue(VariableManager::Value{65.0f}, "time", 0), "1:05", "time");
    ok &= expectEqual(formatTextValue(VariableManager::Value{42.0f}, "percent", 0), "42%", "percent");
    ok &= expectEqual(formatTextValue(VariableManager::Value{3.14159f}, "decimals", 2), "3.14", "decimals");
    ok &= expectEqual(formatTextValue(VariableManager::Value{std::string{"invalid"}}, "integer", 0), "0", "invalid number");

    if (ok) std::cout << "text_value_formatter_test: all checks passed\n";
    return ok ? 0 : 1;
}
