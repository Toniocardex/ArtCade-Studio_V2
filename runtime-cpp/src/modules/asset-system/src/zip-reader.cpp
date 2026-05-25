// =============================================================================
// zip-reader.cpp — Minimal ZIP extractor (Phase 17)
//
// sinflate() is declared in external/sinfl.h and compiled in raylib/rcore.c.
// We include the header in declaration-only mode (no SINFL_IMPLEMENTATION)
// and rely on the raylib link for the actual symbol.
// =============================================================================

#include "zip-reader.h"

// Include sinfl in declaration-only mode — implementation is in raylib/rcore.c
#include "external/sinfl.h"

#include <cstdint>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <vector>
#include <string>

namespace ArtCade {

namespace {

// ---- Security limits ------------------------------------------------------
// Cap any single decompressed entry to 256 MiB. A malicious .artcade can
// declare uncompSize close to 4 GiB (zip-bomb): without this guard
// `std::vector<uint8_t>(e.uncompSize)` would try to allocate it before we
// even start inflating. 256 MiB is well above any plausible game asset.
constexpr uint32_t kMaxEntryUncompressedBytes = 256u * 1024u * 1024u;

// ---- Path sanitisation (Zip-Slip) -----------------------------------------
// Reject entry names that would escape the destination root:
//   • absolute paths        ("/etc/passwd",  "C:\\Windows\\…")
//   • drive letters         ("D:foo")
//   • UNC / device prefixes ("\\\\server\\share", "\\\\?\\…")
//   • parent traversal      any path component equal to ".."
// Forward slashes are the on-the-wire ZIP convention; backslashes appear in
// archives produced by some Windows tools and must be treated the same way.
bool isSafeRelativeEntryName(const std::string& name) {
    if (name.empty()) return false;
    if (name.front() == '/' || name.front() == '\\') return false;
    if (name.size() >= 2 && name[1] == ':') return false; // drive letter
    if (name.size() >= 2 && name[0] == '\\' && name[1] == '\\') return false; // UNC
    std::string component;
    for (char c : name) {
        if (c == '/' || c == '\\') {
            if (component == "..") return false;
            component.clear();
        } else {
            component.push_back(c);
        }
    }
    if (component == "..") return false;
    return true;
}

// ---- Little-endian readers ------------------------------------------------

inline uint16_t rd16(const uint8_t* p) {
    return static_cast<uint16_t>(p[0]) | (static_cast<uint16_t>(p[1]) << 8);
}

inline uint32_t rd32(const uint8_t* p) {
    return  static_cast<uint32_t>(p[0])
          | (static_cast<uint32_t>(p[1]) << 8)
          | (static_cast<uint32_t>(p[2]) << 16)
          | (static_cast<uint32_t>(p[3]) << 24);
}

// ---- ZIP signature constants -----------------------------------------------

constexpr uint32_t SIG_LOCAL  = 0x04034b50u;   // Local File Header
constexpr uint32_t SIG_CD     = 0x02014b50u;   // Central Directory entry
constexpr uint32_t SIG_EOCD   = 0x06054b50u;   // End of Central Directory

// ---- Central Directory entry (parsed) ------------------------------------

struct CDEntry {
    std::string name;
    uint16_t    method;       // 0 = STORE, 8 = DEFLATE
    uint32_t    compSize;
    uint32_t    uncompSize;
    uint32_t    localOff;     // byte offset of Local File Header in archive
};

// ---- Find EOCD and parse Central Directory --------------------------------

bool findEOCD(const uint8_t* buf, size_t len, uint32_t& cdOff, uint16_t& count) {
    // EOCD is at least 22 bytes; ZIP comment max is 65535 bytes.
    if (len < 22) return false;
    const size_t scanStart = len - 22;
    const size_t scanEnd   = (len > 65535u + 22u) ? len - 65535u - 22u : 0u;

    for (ptrdiff_t i = static_cast<ptrdiff_t>(scanStart);
                   i >= static_cast<ptrdiff_t>(scanEnd); --i) {
        if (rd32(buf + i) == SIG_EOCD) {
            count = rd16(buf + i + 10);
            cdOff = rd32(buf + i + 16);
            return true;
        }
    }
    return false;
}

bool parseCentralDirectory(const uint8_t* buf, size_t len,
                           uint32_t cdOff, uint16_t count,
                           std::vector<CDEntry>& entries) {
    if (static_cast<size_t>(cdOff) + 4 > len) return false;
    const uint8_t* p = buf + cdOff;

    for (uint16_t i = 0; i < count; ++i) {
        if (p + 46 > buf + len) return false;
        if (rd32(p) != SIG_CD) return false;

        CDEntry e;
        e.method     = rd16(p + 10);
        e.compSize   = rd32(p + 20);
        e.uncompSize = rd32(p + 24);
        e.localOff   = rd32(p + 42);

        const uint16_t fnLen = rd16(p + 28);
        const uint16_t exLen = rd16(p + 30);
        const uint16_t cmLen = rd16(p + 32);

        e.name.assign(reinterpret_cast<const char*>(p + 46), fnLen);
        entries.push_back(std::move(e));

        p += 46u + fnLen + exLen + cmLen;
        if (p > buf + len) return false;
    }
    return true;
}

// ---- Extract single file entry -------------------------------------------

bool extractEntry(const uint8_t* buf, size_t len,
                  const CDEntry& e,
                  const std::filesystem::path& destRoot) {
    namespace fs = std::filesystem;

    // Skip pure directory entries
    if (e.name.empty() || e.name.back() == '/' || e.name.back() == '\\') return true;

    // Reject malicious entry names BEFORE touching the filesystem.
    if (!isSafeRelativeEntryName(e.name)) return false;

    // Reject zip-bomb sized entries up front (declared size only — the actual
    // inflater is bounded by compSize on the input side).
    if (e.uncompSize > kMaxEntryUncompressedBytes) return false;

    // Locate local file header
    if (e.localOff > len || e.localOff + 30u > len) return false;
    const uint8_t* lh = buf + e.localOff;
    if (rd32(lh) != SIG_LOCAL) return false;

    const uint16_t lhFnLen = rd16(lh + 26);
    const uint16_t lhExLen = rd16(lh + 28);
    const size_t   headerSize = static_cast<size_t>(30u) + lhFnLen + lhExLen;
    if (e.localOff + headerSize > len) return false;
    const uint8_t* dataPtr = lh + headerSize;
    if (static_cast<size_t>(dataPtr - buf) + e.compSize > len) return false;

    // Build destination path, then verify it stays inside destRoot. weakly_
    // canonical resolves "." / ".." and casing so a symlink in the chain
    // cannot escape either. Belt-and-braces with isSafeRelativeEntryName.
    fs::path outPath = destRoot / fs::path(e.name);
    std::error_code ec;
    const fs::path normalisedOut  = fs::weakly_canonical(outPath, ec);
    const fs::path normalisedRoot = fs::weakly_canonical(destRoot, ec);
    if (ec) return false;
    {
        const auto rootStr = normalisedRoot.native();
        const auto outStr  = normalisedOut.native();
        if (outStr.size() < rootStr.size() ||
            outStr.compare(0, rootStr.size(), rootStr) != 0)
            return false;
    }
    fs::create_directories(outPath.parent_path(), ec);
    if (ec) return false;

    std::ofstream out(outPath, std::ios::binary | std::ios::trunc);
    if (!out) return false;

    if (e.method == 0) {
        // STORE — raw copy
        out.write(reinterpret_cast<const char*>(dataPtr),
                  static_cast<std::streamsize>(e.compSize));
    } else if (e.method == 8) {
        // DEFLATE — decompress with sinflate (from raylib/rcore.c)
        std::vector<uint8_t> decompressed(e.uncompSize);
        int result = sinflate(
            decompressed.data(),
            static_cast<int>(e.uncompSize),
            dataPtr,
            static_cast<int>(e.compSize));
        if (result < 0) return false;
        out.write(reinterpret_cast<const char*>(decompressed.data()),
                  static_cast<std::streamsize>(result));
    } else {
        return false;   // unsupported compression method
    }

    return out.good();
}

} // anonymous namespace

// ---- Public API -----------------------------------------------------------

bool zipExtractAll(const std::string& zipPath, const std::string& destDir) {
    namespace fs = std::filesystem;

    // Read entire archive into memory (project ZIPs are small)
    std::ifstream f(zipPath, std::ios::binary);
    if (!f) return false;

    std::vector<uint8_t> data(
        (std::istreambuf_iterator<char>(f)),
        std::istreambuf_iterator<char>());
    if (data.empty()) return false;

    const uint8_t* buf = data.data();
    const size_t   len = data.size();

    // 1. Find EOCD
    uint32_t cdOff  = 0;
    uint16_t count  = 0;
    if (!findEOCD(buf, len, cdOff, count)) return false;

    // 2. Parse Central Directory
    std::vector<CDEntry> entries;
    entries.reserve(count);
    if (!parseCentralDirectory(buf, len, cdOff, count, entries)) return false;

    // 3. Create destination root
    std::error_code ec;
    fs::create_directories(destDir, ec);
    if (ec) return false;

    // 4. Extract each entry
    const fs::path root(destDir);
    for (const auto& e : entries)
        if (!extractEntry(buf, len, e, root)) return false;

    return true;
}

} // namespace ArtCade
