#include "../include/logic-runtime.h"

#include "lua-host.h"

#define SOL_ALL_SAFETIES_ON 1
#include <sol/sol.hpp>
extern "C" {
#include <lua.h>
#include <lauxlib.h>
}

#include <algorithm>
#include <sstream>
#include <unordered_map>
#include <unordered_set>
#include <utility>

namespace ArtCade::Logic {
namespace {

thread_local int64_t g_instructionBudget = 0;

void instructionHook(lua_State* state, lua_Debug*) {
    g_instructionBudget -= 1000;
    if (g_instructionBudget <= 0) luaL_error(state, "Logic callback instruction budget exceeded");
}

std::string callbackError(const std::string& ruleId, EntityId owner, const std::string& error) {
    std::ostringstream out;
    out << "Logic rule " << ruleId << " on entity " << owner << " disabled: " << error;
    return out.str();
}

// Capabilities this LogicRuntime build knows how to execute. A program
// compiled by a newer logic-core (declaring a feature this runtime predates)
// must be rejected up front rather than silently calling an undefined Lua
// method at dispatch time.
const std::unordered_set<std::string>& supportedFeatures() {
    static const std::unordered_set<std::string> value{
        "event.start",
        "input.key_pressed",
        "input.key_released",
        "input.key_held",
        "entity.visibility",
        "entity.transform",
        "platformer.grounded",
        "platformer.move",
        "platformer.jump",
        "collision.enter",
        "collision.exit",
        "collision.other_type",
        "entity.destroy",
        "animation.play_clip",
        "animation.stop",
        "animation.set_playback_speed",
        "audio.play_sound",
    };
    return value;
}

} // namespace

struct LogicRuntime::Impl {
    enum class EventKind { Start, KeyPressed, KeyReleased, KeyHeld, CollisionEnter, CollisionExit };

    struct ContextProxy;

    struct Scope {
        ScopeToken token = 0;
        ObjectTypeId objectTypeId;
        EntityId owner = INVALID_ENTITY;
        bool active = true;
        // Lua closures retain `context`; keep the referenced C++ object at a
        // stable heap address for the complete scope lifetime.
        std::unique_ptr<ContextProxy> context;
    };

    struct Subscription {
        uint64_t token = 0;
        ScopeToken scope = 0;
        EntityId owner = INVALID_ENTITY;
        LogicRuleId ruleId;
        EventKind kind = EventKind::Start;
        LogicKey key = LogicKey::Space;
        sol::protected_function callback;
        bool active = true;
    };

    struct Factory {
        LogicBoardId boardId;
        sol::protected_function function;
    };

    struct SelfProxy {
        Impl* impl = nullptr;
        EntityId owner = INVALID_ENTITY;

        void setVisible(bool value) {
            if (!impl || !impl->host.setVisible(owner, value))
                throw sol::error("set_visible failed for owner");
        }
        void setPosition(float x, float y) {
            if (!impl || !impl->host.setPosition(owner, Vec2{x, y}))
                throw sol::error("set_position failed for owner");
        }
        bool isGrounded() {
            return impl && impl->host.isGrounded(owner);
        }
        void platformerMove(float axis) {
            if (!impl || !impl->host.requestPlatformerMove(owner, axis))
                throw sol::error("platformer_move failed for owner");
        }
        void platformerJump() {
            if (!impl || !impl->host.requestPlatformerJump(owner))
                throw sol::error("platformer_jump failed for owner");
        }
        void destroySelf() {
            if (!impl || !impl->host.requestDestroy(owner))
                throw sol::error("destroy_self failed for owner");
        }
        void playAnimationClip(const std::string& animationAssetId, const std::string& clipId) {
            if (!impl || !impl->host.playAnimationClip(owner, animationAssetId, clipId))
                throw sol::error("play_animation_clip failed for owner");
        }
        void stopAnimation() {
            if (!impl || !impl->host.stopAnimation(owner))
                throw sol::error("stop_animation failed for owner");
        }
        void setAnimationPlaybackSpeed(float speed) {
            if (!impl || !impl->host.setAnimationPlaybackSpeed(owner, speed))
                throw sol::error("set_animation_playback_speed failed for owner");
        }
        void playSound(const std::string& audioAssetId, float volume) {
            if (!impl || !impl->host.playSound(owner, audioAssetId, volume))
                throw sol::error("play_sound failed for owner");
        }
    };

    struct ContextProxy {
        Impl* impl = nullptr;
        ScopeToken scope = 0;
        EntityId owner = INVALID_ENTITY;
        SelfProxy self;

        void onStart(const std::string& ruleId, sol::protected_function callback) {
            impl->addSubscription(scope, owner, ruleId, EventKind::Start,
                                  LogicKey::Space, std::move(callback));
        }
        void onKeyPressed(const std::string& ruleId, const std::string& keyName,
                          sol::protected_function callback) {
            const std::optional<LogicKey> key = logicKeyFromName(keyName);
            if (!key) throw sol::error("Unsupported Logic key: " + keyName);
            impl->addSubscription(scope, owner, ruleId, EventKind::KeyPressed,
                                  *key, std::move(callback));
        }
        void onKeyReleased(const std::string& ruleId, const std::string& keyName,
                           sol::protected_function callback) {
            const std::optional<LogicKey> key = logicKeyFromName(keyName);
            if (!key) throw sol::error("Unsupported Logic key: " + keyName);
            impl->addSubscription(scope, owner, ruleId, EventKind::KeyReleased, *key, std::move(callback));
        }
        void onKeyHeld(const std::string& ruleId, const std::string& keyName,
                       sol::protected_function callback) {
            const std::optional<LogicKey> key = logicKeyFromName(keyName);
            if (!key) throw sol::error("Unsupported Logic key: " + keyName);
            impl->addSubscription(scope, owner, ruleId, EventKind::KeyHeld, *key, std::move(callback));
        }
        void onCollisionEnter(const std::string& ruleId, sol::protected_function callback) {
            impl->addSubscription(scope, owner, ruleId, EventKind::CollisionEnter,
                                  LogicKey::Space, std::move(callback));
        }
        void onCollisionExit(const std::string& ruleId, sol::protected_function callback) {
            impl->addSubscription(scope, owner, ruleId, EventKind::CollisionExit,
                                  LogicKey::Space, std::move(callback));
        }
        bool otherIsObjectType(EntityId other, const std::string& objectTypeId) {
            return impl && other != INVALID_ENTITY && !objectTypeId.empty()
                && impl->host.isObjectType(other, objectTypeId);
        }
    };

    Impl(ILogicRuntimeHost& runtimeHost, LogicRuntimeLimits runtimeLimits)
        : host(runtimeHost), limits(runtimeLimits),
          lua(ArtCade::Modules::LuaHostOptions{
              ArtCade::Modules::LuaSandboxProfile::LogicBoardStrict,
              runtimeLimits.maxMemoryBytes}) {}

    ILogicRuntimeHost& host;
    LogicRuntimeLimits limits;
    ArtCade::Modules::LuaHost lua;
    std::unordered_map<ObjectTypeId, Factory> factories;
    std::vector<Scope> scopes;
    std::vector<Subscription> subscriptions;
    std::vector<std::string> diagnosticLog;
    ScopeToken nextScope = 1;
    uint64_t nextSubscription = 1;
    uint32_t dispatchDepth = 0;
    uint32_t eventsThisFrame = 0;
    bool eventBudgetLogged = false;
    bool initialized = false;
    bool enabled = true;
    bool apiVersionAccepted = false;

    Scope* findScope(ScopeToken token) {
        const auto it = std::find_if(scopes.begin(), scopes.end(),
            [&](const Scope& scope) { return scope.token == token; });
        return it == scopes.end() ? nullptr : &*it;
    }

    Subscription* findSubscription(uint64_t token) {
        const auto it = std::find_if(subscriptions.begin(), subscriptions.end(),
            [&](const Subscription& sub) { return sub.token == token; });
        return it == subscriptions.end() ? nullptr : &*it;
    }

    void addSubscription(ScopeToken scopeToken, EntityId owner,
                         const std::string& ruleId, EventKind kind, LogicKey key,
                         sol::protected_function callback) {
        Scope* scope = findScope(scopeToken);
        if (!scope || !scope->active) throw sol::error("Logic scope is inactive");
        if (!callback.valid()) throw sol::error("Logic callback is invalid");
        const uint32_t inScope = static_cast<uint32_t>(std::count_if(
            subscriptions.begin(), subscriptions.end(), [&](const Subscription& sub) {
                return sub.active && sub.scope == scopeToken;
            }));
        if (inScope >= limits.maxSubscriptionsPerScope)
            throw sol::error("Logic scope subscription limit exceeded");
        if (subscriptions.size() >= limits.maxSubscriptions)
            throw sol::error("Logic session subscription limit exceeded");
        subscriptions.push_back(Subscription{
            nextSubscription++, scopeToken, owner, ruleId, kind, key,
            std::move(callback), true});
    }

    bool callSubscription(uint64_t token, std::optional<EntityId> other = std::nullopt) {
        Subscription* sub = findSubscription(token);
        if (!sub || !sub->active || !enabled) return true;
        if (dispatchDepth >= limits.maxEventDepth) {
            sub->active = false;
            diagnosticLog.push_back(callbackError(sub->ruleId, sub->owner,
                                                   "event depth limit exceeded"));
            return false;
        }
        ++dispatchDepth;
        lua_State* state = sub->callback.lua_state();
        g_instructionBudget = limits.maxInstructionsPerCallback;
        lua_sethook(state, instructionHook, LUA_MASKCOUNT, 1000);
        sol::protected_function_result result = other ? sub->callback(*other) : sub->callback();
        lua_sethook(state, nullptr, 0, 0);
        --dispatchDepth;
        if (!result.valid()) {
            sol::error err = result;
            sub = findSubscription(token);
            if (sub) sub->active = false;
            diagnosticLog.push_back(callbackError(
                sub ? sub->ruleId : std::string("unknown"),
                sub ? sub->owner : INVALID_ENTITY, err.what()));
            if (lua.memoryLimitExceeded()) {
                enabled = false;
                diagnosticLog.push_back("Logic Runtime disabled: memory limit exceeded");
            }
            return false;
        }
        return true;
    }

    void dispatch(EventKind kind, LogicKey key, EntityId owner = INVALID_ENTITY,
                  std::optional<EntityId> other = std::nullopt) {
        if (!enabled || dispatchDepth != 0) return;
        std::vector<uint64_t> snapshot;
        snapshot.reserve(subscriptions.size());
        for (const Subscription& sub : subscriptions) {
            const Scope* scope = nullptr;
            const auto it = std::find_if(scopes.begin(), scopes.end(),
                [&](const Scope& value) { return value.token == sub.scope; });
            if (it != scopes.end()) scope = &*it;
            const bool isCollision = kind == EventKind::CollisionEnter || kind == EventKind::CollisionExit;
            if (sub.active && scope && scope->active && sub.kind == kind
                && (isCollision ? sub.owner == owner : kind == EventKind::Start || sub.key == key)) {
                snapshot.push_back(sub.token);
            }
        }
        const uint32_t available = eventsThisFrame >= limits.maxEventsPerDispatch
            ? 0 : limits.maxEventsPerDispatch - eventsThisFrame;
        if (snapshot.size() > available) {
            snapshot.resize(available);
            if (!eventBudgetLogged) {
                diagnosticLog.push_back("Logic dispatch truncated at the per-frame event budget");
                eventBudgetLogged = true;
            }
        }
        eventsThisFrame += static_cast<uint32_t>(snapshot.size());
        for (uint64_t token : snapshot) callSubscription(token, other);
    }
};

LogicRuntime::LogicRuntime(ILogicRuntimeHost& host, LogicRuntimeLimits limits)
    : impl_(std::make_unique<Impl>(host, limits)) {}

LogicRuntime::~LogicRuntime() { shutdown(); }

bool LogicRuntime::initialize(std::string* error) {
    if (impl_->initialized) return true;
    impl_->lua.registerBindings([impl = impl_.get()](sol::state& lua) {
        lua.new_usertype<Impl::SelfProxy>(
            "LogicSelf", sol::no_constructor,
            "set_visible", &Impl::SelfProxy::setVisible,
            "set_position", &Impl::SelfProxy::setPosition,
            "is_grounded", &Impl::SelfProxy::isGrounded,
            "platformer_move", &Impl::SelfProxy::platformerMove,
            "platformer_jump", &Impl::SelfProxy::platformerJump,
            "destroy_self", &Impl::SelfProxy::destroySelf,
            "play_animation_clip", &Impl::SelfProxy::playAnimationClip,
            "stop_animation", &Impl::SelfProxy::stopAnimation,
            "set_animation_playback_speed", &Impl::SelfProxy::setAnimationPlaybackSpeed,
            "play_sound", &Impl::SelfProxy::playSound);
        lua.new_usertype<Impl::ContextProxy>(
            "LogicContext", sol::no_constructor,
            "self", &Impl::ContextProxy::self,
            "on_start", &Impl::ContextProxy::onStart,
            "on_key_pressed", &Impl::ContextProxy::onKeyPressed,
            "on_key_released", &Impl::ContextProxy::onKeyReleased,
            "on_key_held", &Impl::ContextProxy::onKeyHeld,
            "on_collision_enter", &Impl::ContextProxy::onCollisionEnter,
            "on_collision_exit", &Impl::ContextProxy::onCollisionExit,
            "other_is_object_type", &Impl::ContextProxy::otherIsObjectType);

        sol::table logic = lua.create_named_table("logic");
        logic.set_function("require_api_version", [impl](uint32_t version) {
            if (version != kLogicApiVersion)
                throw sol::error("Unsupported Logic API version");
            impl->apiVersionAccepted = true;
        });
        logic.set_function("define_board",
            [impl](const std::string& boardId, const std::string& objectTypeId,
                   sol::protected_function factory) {
                if (!impl->apiVersionAccepted)
                    throw sol::error("Logic API version was not declared");
                if (boardId.empty() || objectTypeId.empty() || !factory.valid())
                    throw sol::error("Invalid Logic Board program definition");
                if (!impl->factories.emplace(objectTypeId,
                        Impl::Factory{boardId, std::move(factory)}).second)
                    throw sol::error("Duplicate Logic Board program for Object Type");
            });
    });
    if (!impl_->lua.init()) {
        if (error) *error = "Cannot initialize the Logic Board Lua VM";
        return false;
    }
    impl_->initialized = true;
    return true;
}

bool LogicRuntime::loadPrograms(const std::vector<LogicProgram>& programs, std::string* error) {
    if (!initialize(error)) return false;
    if (!impl_->factories.empty()) {
        if (error) *error = "Logic programs were already loaded";
        return false;
    }
    for (const LogicProgram& program : programs) {
        for (const std::string& feature : program.requiredFeatures) {
            if (!supportedFeatures().count(feature)) {
                if (error) *error = "Logic program requires unsupported feature: " + feature;
                impl_->enabled = false;
                return false;
            }
        }
        impl_->apiVersionAccepted = false;
        if (!impl_->lua.loadLuaSource(program.source)) {
            if (error) *error = impl_->lua.lastError();
            impl_->enabled = false;
            return false;
        }
        const auto it = impl_->factories.find(program.objectTypeId);
        if (it == impl_->factories.end() || it->second.boardId != program.boardId) {
            if (error) *error = "Generated Logic program metadata does not match its board";
            impl_->enabled = false;
            return false;
        }
    }
    return true;
}

std::optional<ScopeToken> LogicRuntime::install(const ObjectTypeId& objectTypeId,
                                                EntityId owner, std::string* error) {
    if (!impl_->enabled || owner == INVALID_ENTITY) {
        if (error) *error = "Cannot install an inactive Logic Board scope";
        return std::nullopt;
    }
    const auto factory = impl_->factories.find(objectTypeId);
    if (factory == impl_->factories.end()) return std::nullopt;
    if (impl_->scopes.size() >= impl_->limits.maxScopes) {
        if (error) *error = "Logic scope limit exceeded";
        return std::nullopt;
    }

    const ScopeToken token = impl_->nextScope++;
    impl_->scopes.push_back(Impl::Scope{token, objectTypeId, owner, true, nullptr});
    Impl::Scope* scope = impl_->findScope(token);
    scope->context = std::make_unique<Impl::ContextProxy>(
        Impl::ContextProxy{impl_.get(), token, owner, {impl_.get(), owner}});
    lua_State* state = factory->second.function.lua_state();
    g_instructionBudget = impl_->limits.maxInstructionsPerCallback;
    lua_sethook(state, instructionHook, LUA_MASKCOUNT, 1000);
    sol::protected_function_result result = factory->second.function(*scope->context);
    lua_sethook(state, nullptr, 0, 0);
    if (!result.valid()) {
        sol::error err = result;
        cancelScope(token);
        if (error) *error = err.what();
        return std::nullopt;
    }
    return token;
}

bool LogicRuntime::cancelScope(ScopeToken token) {
    Impl::Scope* scope = impl_->findScope(token);
    if (!scope || !scope->active) return false;
    scope->active = false;
    for (Impl::Subscription& sub : impl_->subscriptions)
        if (sub.scope == token) sub.active = false;
    return true;
}

void LogicRuntime::beginFrame() {
    if (!impl_) return;
    impl_->eventsThisFrame = 0;
    impl_->eventBudgetLogged = false;
}

void LogicRuntime::dispatchStart() { impl_->dispatch(Impl::EventKind::Start, LogicKey::Space); }
void LogicRuntime::dispatchKeyPressed(LogicKey key) {
    impl_->dispatch(Impl::EventKind::KeyPressed, key);
}
void LogicRuntime::dispatchKeyReleased(LogicKey key) {
    impl_->dispatch(Impl::EventKind::KeyReleased, key);
}
void LogicRuntime::dispatchKeyHeld(LogicKey key) {
    impl_->dispatch(Impl::EventKind::KeyHeld, key);
}
void LogicRuntime::dispatchCollisionEnter(EntityId owner, EntityId other) {
    impl_->dispatch(Impl::EventKind::CollisionEnter, LogicKey::Space, owner, other);
}
void LogicRuntime::dispatchCollisionExit(EntityId owner, EntityId other) {
    impl_->dispatch(Impl::EventKind::CollisionExit, LogicKey::Space, owner, other);
}

void LogicRuntime::shutdown() noexcept {
    if (!impl_ || !impl_->initialized) return;
    for (Impl::Scope& scope : impl_->scopes) scope.active = false;
    impl_->subscriptions.clear();
    impl_->factories.clear();
    impl_->scopes.clear();
    impl_->lua.shutdown();
    impl_->enabled = false;
    impl_->initialized = false;
}

bool LogicRuntime::isEnabled() const { return impl_ && impl_->enabled; }
const std::vector<std::string>& LogicRuntime::diagnostics() const {
    return impl_->diagnosticLog;
}

} // namespace ArtCade::Logic
