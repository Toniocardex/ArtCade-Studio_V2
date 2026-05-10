// =============================================================================
// artcade-package-test.cpp — Phase 17: .artcade ZIP round-trip test
//
// Strategy: build a minimal in-memory ZIP (STORE mode, no compression)
// containing a project.json, write it to a temp file, then load it via
// AssetLoader::loadArtcade() and assert the resulting ProjectDoc matches.
//
// Uses only AssetLoader + zip-reader — no Raylib window opened.
// Avoids any file-system assumption about the build environment.
// =============================================================================

#include "modules/asset-system/include/asset-loader.h"

#include <cassert>
#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <string>
#include <vector>

using namespace ArtCade::Modules;
namespace fs = std::filesystem;

// ---- minimal test harness --------------------------------------------------

static int g_passed = 0;
static int g_failed = 0;

#define CHECK(cond) \
    do { \
        if (cond) { \
            ++g_passed; \
        } else { \
            std::cerr << "  FAIL: " #cond "  (line " << __LINE__ << ")\n"; \
            ++g_failed; \
        } \
    } while (false)

// ---- minimal STORE-mode ZIP writer ----------------------------------------
// Produces a valid ZIP with method=0 (STORE, no compression).
// Sufficient for testing the loader; the Python packer produces DEFLATE ZIPs
// which test the sinflate path in production.

namespace MinimalZip {

static void push16(std::vector<uint8_t>& v, uint16_t x) {
    v.push_back(static_cast<uint8_t>(x));
    v.push_back(static_cast<uint8_t>(x >> 8));
}
static void push32(std::vector<uint8_t>& v, uint32_t x) {
    v.push_back(static_cast<uint8_t>(x));
    v.push_back(static_cast<uint8_t>(x >>  8));
    v.push_back(static_cast<uint8_t>(x >> 16));
    v.push_back(static_cast<uint8_t>(x >> 24));
}
static void pushStr(std::vector<uint8_t>& v, const std::string& s) {
    v.insert(v.end(), s.begin(), s.end());
}
static void pushBytes(std::vector<uint8_t>& v, const std::vector<uint8_t>& b) {
    v.insert(v.end(), b.begin(), b.end());
}

// Simple CRC-32 (lookup table, polynomial 0xEDB88320)
static uint32_t crc32(const uint8_t* data, size_t len) {
    static uint32_t table[256] = {};
    static bool     ready      = false;
    if (!ready) {
        for (uint32_t i = 0; i < 256; ++i) {
            uint32_t c = i;
            for (int k = 0; k < 8; ++k) c = (c & 1) ? (0xEDB88320u ^ (c >> 1)) : (c >> 1);
            table[i] = c;
        }
        ready = true;
    }
    uint32_t crc = 0xFFFFFFFFu;
    for (size_t i = 0; i < len; ++i)
        crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >> 8);
    return crc ^ 0xFFFFFFFFu;
}

struct Entry {
    std::string           name;
    std::vector<uint8_t>  data;
};

std::vector<uint8_t> build(const std::vector<Entry>& entries) {
    std::vector<uint8_t> buf;
    std::vector<uint32_t> offsets;   // local file header offsets

    // Local File Headers + data
    for (const auto& e : entries) {
        offsets.push_back(static_cast<uint32_t>(buf.size()));

        const uint32_t crc  = crc32(e.data.data(), e.data.size());
        const uint32_t sz   = static_cast<uint32_t>(e.data.size());
        const uint16_t fnLen = static_cast<uint16_t>(e.name.size());

        push32(buf, 0x04034b50u);   // Local file header signature
        push16(buf, 20);            // Version needed (2.0)
        push16(buf, 0);             // General purpose bit flag
        push16(buf, 0);             // Compression method: STORE
        push16(buf, 0);             // Last mod time
        push16(buf, 0);             // Last mod date
        push32(buf, crc);           // CRC-32
        push32(buf, sz);            // Compressed size
        push32(buf, sz);            // Uncompressed size
        push16(buf, fnLen);         // Filename length
        push16(buf, 0);             // Extra field length
        pushStr(buf, e.name);       // Filename
        pushBytes(buf, e.data);     // File data (STORE = raw)
    }

    // Central Directory
    const uint32_t cdOffset = static_cast<uint32_t>(buf.size());
    for (size_t idx = 0; idx < entries.size(); ++idx) {
        const auto& e = entries[idx];
        const uint32_t crc  = crc32(e.data.data(), e.data.size());
        const uint32_t sz   = static_cast<uint32_t>(e.data.size());
        const uint16_t fnLen = static_cast<uint16_t>(e.name.size());

        push32(buf, 0x02014b50u);   // Central directory signature
        push16(buf, 20);            // Version made by
        push16(buf, 20);            // Version needed
        push16(buf, 0);             // Bit flag
        push16(buf, 0);             // Compression method: STORE
        push16(buf, 0);             // Last mod time
        push16(buf, 0);             // Last mod date
        push32(buf, crc);           // CRC-32
        push32(buf, sz);            // Compressed size
        push32(buf, sz);            // Uncompressed size
        push16(buf, fnLen);         // Filename length
        push16(buf, 0);             // Extra field length
        push16(buf, 0);             // Comment length
        push16(buf, 0);             // Disk number start
        push16(buf, 0);             // Internal attributes
        push32(buf, 0);             // External attributes
        push32(buf, offsets[idx]);  // Offset of local file header
        pushStr(buf, e.name);       // Filename
    }

    const uint32_t cdSize  = static_cast<uint32_t>(buf.size()) - cdOffset;
    const uint16_t nEntries = static_cast<uint16_t>(entries.size());

    // End of Central Directory
    push32(buf, 0x06054b50u);   // EOCD signature
    push16(buf, 0);             // Disk number
    push16(buf, 0);             // Disk with central dir
    push16(buf, nEntries);      // Entries on this disk
    push16(buf, nEntries);      // Total entries
    push32(buf, cdSize);        // Size of central directory
    push32(buf, cdOffset);      // Offset of central directory
    push16(buf, 0);             // Comment length

    return buf;
}

} // namespace MinimalZip

// ---- helpers ---------------------------------------------------------------

static std::string tmpZipPath() {
    return (fs::temp_directory_path() / "artcade_test_roundtrip.artcade").string();
}

static void writeToDisk(const std::string& path, const std::vector<uint8_t>& data) {
    std::ofstream f(path, std::ios::binary | std::ios::trunc);
    f.write(reinterpret_cast<const char*>(data.data()),
            static_cast<std::streamsize>(data.size()));
}

// ---- tests -----------------------------------------------------------------

static void test_minimal_zip_load() {
    std::cout << "Test 1: loadArtcade — minimal STORE-mode ZIP\n";

    // Build a minimal project.json content
    const std::string projJson = R"({
  "projectName":   "TestProject",
  "version":       "2.0.0",
  "gameResolution": [1280, 720],
  "targetFPS":     60,
  "activeSceneId": "scene_main",
  "mainScriptPath": "scripts/main.lua",
  "entities": {
    "1": {
      "id": 1,
      "name": "Hero",
      "className": "Player",
      "tags": ["player"],
      "transform": { "position": [320, 240], "scale": [1,1], "rotation": 0 },
      "sprite": { "spriteAssetId": "", "tint": [1,1,1,1], "alpha": 1, "renderOrder": 0 }
    }
  },
  "scenes": {
    "scene_main": {
      "id":   "scene_main",
      "name": "Main Scene",
      "worldSize":       [1280, 720],
      "viewportSize":    [1280, 720],
      "backgroundColor": [0.1, 0.1, 0.2, 1.0],
      "entityIds": [1]
    }
  }
})";

    const std::string mainLua = "-- test script\nfunction tick(dt) end\n";

    // Pack into a minimal ZIP (STORE mode)
    using namespace MinimalZip;
    auto zipBytes = build({
        { "project.json",    std::vector<uint8_t>(projJson.begin(), projJson.end()) },
        { "scripts/main.lua",std::vector<uint8_t>(mainLua.begin(),  mainLua.end())  },
    });

    const std::string zipPath = tmpZipPath();
    writeToDisk(zipPath, zipBytes);
    CHECK(fs::exists(zipPath));
    CHECK(fs::file_size(zipPath) > 0);

    // Load via AssetLoader
    AssetLoader loader;
    loader.init();

    ArtCade::ProjectDoc doc;
    bool ok = loader.loadArtcade(zipPath, doc);

    CHECK(ok);
    if (ok) {
        CHECK(doc.projectName   == "TestProject");
        CHECK(doc.version       == "2.0.0");
        CHECK(doc.activeSceneId == "scene_main");
        CHECK(doc.gameResolution.x == 1280.f);
        CHECK(doc.gameResolution.y == 720.f);
        CHECK(doc.targetFPS        == 60.f);

        // Entity checks
        CHECK(doc.entities.size() == 1);
        auto it = doc.entities.find(1);
        CHECK(it != doc.entities.end());
        if (it != doc.entities.end()) {
            CHECK(it->second.name      == "Hero");
            CHECK(it->second.className == "Player");
            CHECK(it->second.transform.position.x == 320.f);
            CHECK(it->second.transform.position.y == 240.f);
        }

        // Scene checks
        CHECK(doc.scenes.size() == 1);
        auto sit = doc.scenes.find("scene_main");
        CHECK(sit != doc.scenes.end());
        if (sit != doc.scenes.end()) {
            CHECK(sit->second.name          == "Main Scene");
            CHECK(sit->second.entityIds.size() == 1);
            CHECK(sit->second.entityIds[0]     == 1u);
        }
    } else {
        std::cerr << "  [artcade-package] loadArtcade() returned false — check zip-reader\n";
    }

    loader.shutdown();

    // Cleanup
    fs::remove(zipPath);
}

static void test_invalid_zip_returns_false() {
    std::cout << "Test 2: loadArtcade — corrupt ZIP returns false\n";

    const std::string path = (fs::temp_directory_path() / "artcade_corrupt.artcade").string();

    // Write garbage bytes
    std::vector<uint8_t> garbage = { 0xDE, 0xAD, 0xBE, 0xEF, 0x00, 0x11, 0x22 };
    writeToDisk(path, garbage);

    AssetLoader loader;
    loader.init();

    ArtCade::ProjectDoc doc;
    bool ok = loader.loadArtcade(path, doc);
    CHECK(!ok);   // must return false, not crash

    loader.shutdown();
    fs::remove(path);
}

static void test_nonexistent_file_returns_false() {
    std::cout << "Test 3: loadArtcade — non-existent file returns false\n";

    AssetLoader loader;
    loader.init();

    ArtCade::ProjectDoc doc;
    bool ok = loader.loadArtcade("/does/not/exist.artcade", doc);
    CHECK(!ok);

    loader.shutdown();
}

static void test_directory_load_still_works() {
    std::cout << "Test 4: loadDirectory — regression check still passes\n";

    // Build a temp directory with a minimal project.json
    const fs::path tmpDir = fs::temp_directory_path() / "artcade_test_dir";
    fs::create_directories(tmpDir);

    const std::string proj = R"({
  "projectName": "DirProject",
  "version": "1.0.0",
  "activeSceneId": "s1",
  "entities": {},
  "scenes": {
    "s1": { "id":"s1", "name":"S1", "entityIds": [] }
  }
})";
    {
        std::ofstream f((tmpDir / "project.json").string());
        f << proj;
    }

    AssetLoader loader;
    loader.init();

    ArtCade::ProjectDoc doc;
    bool ok = loader.loadDirectory(tmpDir.string(), doc);

    CHECK(ok);
    CHECK(doc.projectName   == "DirProject");
    CHECK(doc.activeSceneId == "s1");
    CHECK(doc.scenes.size() == 1);

    loader.shutdown();

    // Cleanup
    fs::remove_all(tmpDir);
}

// ---- main ------------------------------------------------------------------

int main() {
    std::cout << "=== ArtCade Package (.artcade) Tests ===\n";

    test_minimal_zip_load();
    test_invalid_zip_returns_false();
    test_nonexistent_file_returns_false();
    test_directory_load_still_works();

    std::cout << "\nResults: " << g_passed << " passed, "
              << g_failed  << " failed\n";
    return g_failed > 0 ? 1 : 0;
}
