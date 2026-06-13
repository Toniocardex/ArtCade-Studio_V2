#include "../include/variable-manager.h"

#include <algorithm>

namespace ArtCade::Modules {

bool VariableManager::init() {
    clear();
    observers_.clear();
    nextToken_ = 1;
    return true;
}

void VariableManager::shutdown() {
    clear();
    observers_.clear();
}

bool VariableManager::valueMatchesType(
    const Value& value, GameVariableDefinition::Type type) {
    switch (type) {
        case GameVariableDefinition::Type::Number:  return std::holds_alternative<double>(value);
        case GameVariableDefinition::Type::Boolean: return std::holds_alternative<bool>(value);
        case GameVariableDefinition::Type::String:  return std::holds_alternative<std::string>(value);
    }
    return false;
}

void VariableManager::configureGlobals(
    const std::vector<GameVariableDefinition>& definitions) {
    vars_.clear();
    globalTypes_.clear();
    for (const auto& def : definitions) {
        if (def.key.empty() || globalTypes_.count(def.key)
            || !valueMatchesType(def.initialValue, def.type)) continue;
        globalTypes_[def.key] = def.type;
        vars_[def.key] = def.initialValue;
    }
}

void VariableManager::createEntity(
    EntityId id,
    const std::vector<GameVariableDefinition>& definitions,
    const Snapshot& overrides) {
    Snapshot values;
    std::unordered_map<std::string, GameVariableDefinition::Type> types;
    for (const auto& def : definitions) {
        if (def.key.empty() || types.count(def.key)
            || !valueMatchesType(def.initialValue, def.type)) continue;
        types[def.key] = def.type;
        auto overrideIt = overrides.find(def.key);
        values[def.key] = overrideIt != overrides.end()
            && valueMatchesType(overrideIt->second, def.type)
            ? overrideIt->second
            : def.initialValue;
    }
    entityTypes_[id] = std::move(types);
    entityVars_[id] = std::move(values);
}

void VariableManager::destroyEntity(EntityId id) {
    entityVars_.erase(id);
    entityTypes_.erase(id);
}

VariableManager::Value VariableManager::get(
    const std::string& key, const Value& defaultVal) const {
    auto it = vars_.find(key);
    return it != vars_.end() ? it->second : defaultVal;
}

int32_t VariableManager::getInt(const std::string& key, int32_t def) const {
    auto it = vars_.find(key);
    return it != vars_.end() && std::holds_alternative<double>(it->second)
        ? static_cast<int32_t>(std::get<double>(it->second)) : def;
}

float VariableManager::getFloat(const std::string& key, float def) const {
    auto it = vars_.find(key);
    return it != vars_.end() && std::holds_alternative<double>(it->second)
        ? static_cast<float>(std::get<double>(it->second)) : def;
}

bool VariableManager::getBool(const std::string& key, bool def) const {
    auto it = vars_.find(key);
    return it != vars_.end() && std::holds_alternative<bool>(it->second)
        ? std::get<bool>(it->second) : def;
}

std::string VariableManager::getString(const std::string& key, std::string def) const {
    auto it = vars_.find(key);
    return it != vars_.end() && std::holds_alternative<std::string>(it->second)
        ? std::get<std::string>(it->second) : def;
}

bool VariableManager::exists(const std::string& key) const { return vars_.count(key) != 0; }

bool VariableManager::entityExists(EntityId id, const std::string& key) const {
    auto it = entityVars_.find(id);
    return it != entityVars_.end() && it->second.count(key) != 0;
}

VariableManager::Value VariableManager::getEntity(EntityId id, const std::string& key) const {
    auto entityIt = entityVars_.find(id);
    if (entityIt == entityVars_.end()) return 0.0;
    auto valueIt = entityIt->second.find(key);
    return valueIt != entityIt->second.end() ? valueIt->second : Value{0.0};
}

void VariableManager::set(const std::string& key, const Value& value) {
    auto typeIt = globalTypes_.find(key);
    if (typeIt == globalTypes_.end() || !valueMatchesType(value, typeIt->second)) return;
    vars_[key] = value;
    notifyObservers(key, value);
}

void VariableManager::setInt(const std::string& key, int32_t value) { set(key, static_cast<double>(value)); }
void VariableManager::setFloat(const std::string& key, float value) { set(key, static_cast<double>(value)); }
void VariableManager::setBool(const std::string& key, bool value) { set(key, value); }
void VariableManager::setString(const std::string& key, std::string value) { set(key, std::move(value)); }

bool VariableManager::setEntity(EntityId id, const std::string& key, const Value& value) {
    auto entityTypeIt = entityTypes_.find(id);
    if (entityTypeIt == entityTypes_.end()) return false;
    auto typeIt = entityTypeIt->second.find(key);
    if (typeIt == entityTypeIt->second.end() || !valueMatchesType(value, typeIt->second)) return false;
    entityVars_[id][key] = value;
    return true;
}

int32_t VariableManager::addInt(const std::string& key, int32_t delta,
                                std::optional<int32_t> min,
                                std::optional<int32_t> max) {
    double value = getFloat(key, 0.f) + delta;
    if (min) value = std::max(value, static_cast<double>(*min));
    if (max) value = std::min(value, static_cast<double>(*max));
    set(key, value);
    return static_cast<int32_t>(value);
}

float VariableManager::addFloat(const std::string& key, float delta,
                                std::optional<float> min,
                                std::optional<float> max) {
    double value = getFloat(key, 0.f) + delta;
    if (min) value = std::max(value, static_cast<double>(*min));
    if (max) value = std::min(value, static_cast<double>(*max));
    set(key, value);
    return static_cast<float>(value);
}

std::optional<double> VariableManager::addEntity(
    EntityId id, const std::string& key, double delta) {
    if (!entityExists(id, key)) return std::nullopt;
    const Value current = getEntity(id, key);
    if (!std::holds_alternative<double>(current)) return std::nullopt;
    const double next = std::get<double>(current) + delta;
    return setEntity(id, key, next) ? std::optional<double>{next} : std::nullopt;
}

bool VariableManager::toggle(const std::string& key) {
    const bool next = !getBool(key, false);
    set(key, next);
    return next;
}

void VariableManager::remove(const std::string& key) {
    vars_.erase(key);
    globalTypes_.erase(key);
}

void VariableManager::clear() {
    vars_.clear();
    globalTypes_.clear();
    entityVars_.clear();
    entityTypes_.clear();
}

VariableManager::ObsToken VariableManager::observe(const std::string& key, Observer cb) {
    const ObsToken token = nextToken_++;
    observers_.push_back({token, key, std::move(cb)});
    return token;
}

void VariableManager::stopObserving(ObsToken token) {
    observers_.erase(std::remove_if(observers_.begin(), observers_.end(),
        [token](const ObsEntry& entry) { return entry.token == token; }), observers_.end());
}

void VariableManager::notifyObservers(const std::string& key, const Value& value) {
    for (auto& entry : observers_) if (entry.key == key) entry.cb(key, value);
}

VariableManager::Snapshot VariableManager::takeSnapshot() const { return vars_; }

VariableManager::Snapshot VariableManager::takeEntitySnapshot(EntityId id) const {
    auto it = entityVars_.find(id);
    return it != entityVars_.end() ? it->second : Snapshot{};
}

void VariableManager::restoreSnapshot(const Snapshot& snapshot) {
    for (const auto& [key, value] : snapshot) set(key, value);
}

VariableManager::GameSnapshot VariableManager::takeGameSnapshot(
    const std::vector<EntityId>& persistentIds) const {
    GameSnapshot result{vars_, {}};
    for (EntityId id : persistentIds) {
        auto it = entityVars_.find(id);
        if (it != entityVars_.end()) result.entities[id] = it->second;
    }
    return result;
}

bool VariableManager::restoreGameSnapshot(
    const GameSnapshot& snapshot, const std::vector<EntityId>& persistentIds) {
    if (snapshot.globals.size() != globalTypes_.size()) return false;
    for (const auto& [key, _] : globalTypes_) {
        if (snapshot.globals.count(key) == 0) return false;
    }
    for (const auto& [key, value] : snapshot.globals) {
        auto typeIt = globalTypes_.find(key);
        if (typeIt == globalTypes_.end() || !valueMatchesType(value, typeIt->second)) return false;
    }
    for (EntityId id : persistentIds) {
        auto savedIt = snapshot.entities.find(id);
        auto typesIt = entityTypes_.find(id);
        if (typesIt == entityTypes_.end()) return false;
        if (savedIt == snapshot.entities.end()
            || savedIt->second.size() != typesIt->second.size()) return false;
        for (const auto& [key, value] : savedIt->second) {
            auto typeIt = typesIt->second.find(key);
            if (typeIt == typesIt->second.end() || !valueMatchesType(value, typeIt->second)) return false;
        }
    }
    for (const auto& [key, value] : snapshot.globals) set(key, value);
    for (EntityId id : persistentIds) {
        auto savedIt = snapshot.entities.find(id);
        if (savedIt == snapshot.entities.end()) continue;
        for (const auto& [key, value] : savedIt->second) setEntity(id, key, value);
    }
    return true;
}

} // namespace ArtCade::Modules
