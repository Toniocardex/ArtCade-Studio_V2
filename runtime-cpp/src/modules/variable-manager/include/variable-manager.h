#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include <string>
#include <variant>
#include <unordered_map>
#include <optional>
#include <functional>
#include <vector>
#include <cstdint>

namespace ArtCade::Modules {

/**
 * VariableManager — typed global variable store.
 *
 * Stores int32, float, bool and string values under string keys.
 * Supports:
 *   - get / set / add / toggle helpers
 *   - optional default fallback for get
 *   - change observers (key-specific callbacks fired on set)
 *   - snapshot / restore for checkpoint or undo support
 *
 * Intended as the single source of truth for game-wide state
 * (score, lives, flags, dialogue counters, …).
 */
class VariableManager final : public IModule {
public:
    VariableManager() = default;

    bool init()     override;
    void shutdown() override;

    using Value    = GameVariableValue;
    using Observer = std::function<void(const std::string& key, const Value& newVal)>;
    using ObsToken = uint32_t;
    using Snapshot = std::unordered_map<std::string, Value>;
    using EntitySnapshot = std::unordered_map<EntityId, Snapshot>;

    struct GameSnapshot {
        Snapshot globals;
        EntitySnapshot entities;
    };

    void configureGlobals(const std::vector<GameVariableDefinition>& definitions);
    void createEntity(EntityId id,
                      const std::vector<GameVariableDefinition>& definitions,
                      const Snapshot& overrides = {});
    void destroyEntity(EntityId id);

    // ------------------------------------------------------------------ get

    // Returns the stored value or defaultVal if key is absent
    Value       get(const std::string& key, const Value& defaultVal = {}) const;
    int32_t     getInt  (const std::string& key, int32_t     def = 0)     const;
    float       getFloat(const std::string& key, float       def = 0.f)   const;
    bool        getBool (const std::string& key, bool        def = false)  const;
    std::string getString(const std::string& key, std::string def = "")   const;

    bool exists(const std::string& key) const;
    bool entityExists(EntityId id, const std::string& key) const;
    Value getEntity(EntityId id, const std::string& key) const;

    // ------------------------------------------------------------------ set

    void set(const std::string& key, const Value& value);
    void setInt   (const std::string& key, int32_t     v);
    void setFloat (const std::string& key, float       v);
    void setBool  (const std::string& key, bool        v);
    void setString(const std::string& key, std::string v);
    bool setEntity(EntityId id, const std::string& key, const Value& value);

    // Convenience: increment int / float by delta; clamps between min and max if provided
    int32_t addInt  (const std::string& key, int32_t  delta,
                     std::optional<int32_t> min = {}, std::optional<int32_t> max = {});
    float   addFloat(const std::string& key, float    delta,
                     std::optional<float>   min = {}, std::optional<float>   max = {});
    std::optional<double> addEntity(EntityId id, const std::string& key, double delta);

    // Toggle a bool variable (false → true → false …)
    bool toggle(const std::string& key);

    void remove(const std::string& key);
    void clear();

    // ------------------------------------------------------------------ observe

    ObsToken observe(const std::string& key, Observer cb);
    void     stopObserving(ObsToken token);

    // ------------------------------------------------------------------ snapshot

    Snapshot takeSnapshot() const;
    Snapshot takeEntitySnapshot(EntityId id) const;
    void     restoreSnapshot(const Snapshot& snap);
    GameSnapshot takeGameSnapshot(const std::vector<EntityId>& persistentIds) const;
    bool restoreGameSnapshot(const GameSnapshot& snapshot,
                             const std::vector<EntityId>& persistentIds);

private:
    std::unordered_map<std::string, Value> vars_;
    std::unordered_map<std::string, GameVariableDefinition::Type> globalTypes_;
    std::unordered_map<EntityId, Snapshot> entityVars_;
    std::unordered_map<EntityId,
        std::unordered_map<std::string, GameVariableDefinition::Type>> entityTypes_;

    struct ObsEntry {
        ObsToken token;
        std::string key;
        Observer    cb;
    };
    std::vector<ObsEntry> observers_;
    ObsToken nextToken_ = 1;

    void notifyObservers(const std::string& key, const Value& val);
    static bool valueMatchesType(const Value& value, GameVariableDefinition::Type type);
};

} // namespace ArtCade::Modules
