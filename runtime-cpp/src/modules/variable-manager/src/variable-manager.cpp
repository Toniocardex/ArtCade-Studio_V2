#include "../include/variable-manager.h"
#include <algorithm>
#include <stdexcept>

namespace ArtCade::Modules {

bool VariableManager::init() {
    vars_.clear();
    observers_.clear();
    nextToken_ = 1;
    return true;
}

void VariableManager::shutdown() {
    vars_.clear();
    observers_.clear();
}

// ------------------------------------------------------------------ get

VariableManager::Value VariableManager::get(const std::string& key,
                                             const Value& defaultVal) const {
    auto it = vars_.find(key);
    return (it != vars_.end()) ? it->second : defaultVal;
}

int32_t VariableManager::getInt(const std::string& key, int32_t def) const {
    auto it = vars_.find(key);
    if (it == vars_.end()) return def;
    if (auto* v = std::get_if<int32_t>(&it->second)) return *v;
    return def;
}

float VariableManager::getFloat(const std::string& key, float def) const {
    auto it = vars_.find(key);
    if (it == vars_.end()) return def;
    if (auto* v = std::get_if<float>(&it->second)) return *v;
    return def;
}

bool VariableManager::getBool(const std::string& key, bool def) const {
    auto it = vars_.find(key);
    if (it == vars_.end()) return def;
    if (auto* v = std::get_if<bool>(&it->second)) return *v;
    return def;
}

std::string VariableManager::getString(const std::string& key, std::string def) const {
    auto it = vars_.find(key);
    if (it == vars_.end()) return def;
    if (auto* v = std::get_if<std::string>(&it->second)) return *v;
    return def;
}

bool VariableManager::exists(const std::string& key) const {
    return vars_.count(key) > 0;
}

// ------------------------------------------------------------------ set

void VariableManager::set(const std::string& key, const Value& value) {
    vars_[key] = value;
    notifyObservers(key, value);
}

void VariableManager::setInt   (const std::string& key, int32_t v)     { set(key, v); }
void VariableManager::setFloat (const std::string& key, float v)       { set(key, v); }
void VariableManager::setBool  (const std::string& key, bool v)        { set(key, v); }
void VariableManager::setString(const std::string& key, std::string v) { set(key, std::move(v)); }

int32_t VariableManager::addInt(const std::string& key, int32_t delta,
                                  std::optional<int32_t> min,
                                  std::optional<int32_t> max) {
    int32_t cur = getInt(key, 0) + delta;
    if (min && cur < *min) cur = *min;
    if (max && cur > *max) cur = *max;
    setInt(key, cur);
    return cur;
}

float VariableManager::addFloat(const std::string& key, float delta,
                                  std::optional<float> min,
                                  std::optional<float> max) {
    float cur = getFloat(key, 0.f) + delta;
    if (min && cur < *min) cur = *min;
    if (max && cur > *max) cur = *max;
    setFloat(key, cur);
    return cur;
}

bool VariableManager::toggle(const std::string& key) {
    bool next = !getBool(key, false);
    setBool(key, next);
    return next;
}

void VariableManager::remove(const std::string& key) {
    vars_.erase(key);
}

void VariableManager::clear() {
    vars_.clear();
}

// ------------------------------------------------------------------ observe

VariableManager::ObsToken VariableManager::observe(const std::string& key, Observer cb) {
    ObsToken tok = nextToken_++;
    observers_.push_back({ tok, key, std::move(cb) });
    return tok;
}

void VariableManager::stopObserving(ObsToken token) {
    observers_.erase(
        std::remove_if(observers_.begin(), observers_.end(),
            [token](const ObsEntry& e){ return e.token == token; }),
        observers_.end());
}

void VariableManager::notifyObservers(const std::string& key, const Value& val) {
    for (auto& entry : observers_)
        if (entry.key == key)
            entry.cb(key, val);
}

// ------------------------------------------------------------------ snapshot

VariableManager::Snapshot VariableManager::takeSnapshot() const {
    return vars_;
}

void VariableManager::restoreSnapshot(const Snapshot& snap) {
    vars_ = snap;
}

} // namespace ArtCade::Modules
