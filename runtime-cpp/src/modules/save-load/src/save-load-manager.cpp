#include "../include/save-load-manager.h"
#include <fstream>
#include <sstream>
#include <filesystem>
#include <algorithm>

namespace fs = std::filesystem;

namespace ArtCade::Modules {

bool SaveLoadManager::init() {
    return true;
}

void SaveLoadManager::shutdown() {}

// ------------------------------------------------------------------ directory

void SaveLoadManager::setSaveDirectory(const std::string& dir) {
    saveDir_ = dir;
    if (!saveDir_.empty() && saveDir_.back() != '/' && saveDir_.back() != '\\')
        saveDir_ += '/';
}

const std::string& SaveLoadManager::saveDirectory() const {
    return saveDir_;
}

std::string SaveLoadManager::slotPath(const std::string& slot) const {
    return saveDir_ + slot + ".sav";
}

bool SaveLoadManager::ensureSaveDir() const {
    if (saveDir_.empty()) return false;
    std::error_code ec;
    fs::create_directories(saveDir_, ec);
    return !ec;
}

// ------------------------------------------------------------------ serialization

std::string SaveLoadManager::serializeSnapshot(const Snapshot& snap) {
    std::ostringstream ss;
    for (const auto& [key, val] : snap) {
        std::visit([&](const auto& v) {
            using T = std::decay_t<decltype(v)>;
            if constexpr (std::is_same_v<T, int32_t>)
                ss << "i:" << key << "=" << v << '\n';
            else if constexpr (std::is_same_v<T, float>)
                ss << "f:" << key << "=" << v << '\n';
            else if constexpr (std::is_same_v<T, bool>)
                ss << "b:" << key << "=" << (v ? 1 : 0) << '\n';
            else if constexpr (std::is_same_v<T, std::string>)
                ss << "s:" << key << "=" << v << '\n';
        }, val);
    }
    return ss.str();
}

std::optional<SaveLoadManager::Snapshot>
SaveLoadManager::deserializeSnapshot(const std::string& content) {
    Snapshot snap;
    std::istringstream ss(content);
    std::string line;

    while (std::getline(ss, line)) {
        if (line.size() < 3) continue;
        char type = line[0];
        if (line[1] != ':') continue;

        auto eq = line.find('=', 2);
        if (eq == std::string::npos) continue;

        std::string key   = line.substr(2, eq - 2);
        std::string value = line.substr(eq + 1);

        try {
            switch (type) {
            case 'i': snap[key] = static_cast<int32_t>(std::stol(value));  break;
            case 'f': snap[key] = std::stof(value);                         break;
            case 'b': snap[key] = (value == "1");                           break;
            case 's': snap[key] = value;                                    break;
            default: break;
            }
        } catch (...) {
            return std::nullopt;
        }
    }
    return snap;
}

// ------------------------------------------------------------------ save / load

bool SaveLoadManager::save(const std::string& slot, const Snapshot& snapshot) {
    if (!ensureSaveDir()) return false;

    std::ofstream f(slotPath(slot));
    if (!f.is_open()) return false;

    f << serializeSnapshot(snapshot);
    return f.good();
}

std::optional<SaveLoadManager::Snapshot>
SaveLoadManager::load(const std::string& slot) const {
    std::ifstream f(slotPath(slot));
    if (!f.is_open()) return std::nullopt;

    std::string content((std::istreambuf_iterator<char>(f)),
                         std::istreambuf_iterator<char>());
    return deserializeSnapshot(content);
}

// ------------------------------------------------------------------ query

bool SaveLoadManager::hasSave(const std::string& slot) const {
    return fs::exists(slotPath(slot));
}

void SaveLoadManager::deleteSave(const std::string& slot) {
    std::error_code ec;
    fs::remove(slotPath(slot), ec);
}

std::vector<std::string> SaveLoadManager::listSlots() const {
    std::vector<std::string> result;
    std::error_code ec;
    if (!fs::exists(saveDir_, ec)) return result;

    for (const auto& entry : fs::directory_iterator(saveDir_, ec)) {
        if (entry.path().extension() == ".sav")
            result.push_back(entry.path().stem().string());
    }
    std::sort(result.begin(), result.end());
    return result;
}

} // namespace ArtCade::Modules
