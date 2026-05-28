#include "../src/modules/dialog/include/dialog-parser.h"

#include <cstdlib>
#include <filesystem>
#include <iostream>
#include <string>

namespace fs = std::filesystem;

static int failures = 0;

static void expect(bool cond, const char* msg) {
    if (!cond) {
        std::cerr << "  [fail] " << msg << "\n";
        ++failures;
    } else {
        std::cout << "  [ok] " << msg << "\n";
    }
}

int main() {
    fs::path golden = fs::path(ARTCADE_REPO_ROOT) / "docs/examples/dialogs/innkeeper.json";
    if (!fs::exists(golden)) {
        golden = fs::path("docs/examples/dialogs/innkeeper.json");
    }

    auto result = ArtCade::Modules::DialogParser::parseFile(golden.string());
    expect(result.ok(), "parse innkeeper golden JSON");
    expect(result.graph.dialogId == "innkeeper", "dialogId");
    expect(result.graph.startNode == "n1", "startNode");
    expect(result.graph.nodes.count("n3") == 1, "choice node n3");
    expect(result.graph.nodes.at("n3").options.size() == 2, "two choices");

    const std::string bad = R"({"dialogId":"x","startNode":"missing","nodes":{}})";
    auto badResult = ArtCade::Modules::DialogParser::parseJsonString(bad);
    expect(!badResult.ok(), "reject orphan startNode");

    std::cout << failures << " failure(s)\n";
    return failures == 0 ? 0 : 1;
}
