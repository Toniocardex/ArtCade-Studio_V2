#pragma once

#include "../../../core/module.h"
#include "../../../core/types.h"
#include "dialog-types.h"
#include "dialog-renderer.h"

#include <optional>
#include <string>
#include <unordered_map>
#include <unordered_set>

namespace ArtCade {

struct EngineContext;

namespace Modules {

class EventBus;
class VariableManager;
class TimeManager;
class Input;
class Renderer;

class DialogManager final : public IModule {
public:
    DialogManager() = default;

    bool init() override;
    void shutdown() override;

    void setContext(const EngineContext* ctx);

    bool loadDialogsFromDirectory(const std::string& projectRoot);
    void registerGraph(DialogGraph graph);
    const DialogGraph* getGraph(const std::string& dialogId) const;

    bool startDialog(EntityId hostEntityId, const std::string& dialogId);
    void endDialog();

    void tick(float dt);
    void render();

    bool isActive() const { return session_.has_value(); }
    bool isBlocking() const { return isActive(); }

    EntityId hostEntity() const;

    /** Optional locale table: textKey → localized string. */
    void setLocaleStrings(std::unordered_map<std::string, std::string> strings);

private:
    const EngineContext* ctx_ = nullptr;
    DialogRenderer       renderer_;

    std::unordered_map<std::string, DialogGraph> graphs_;
    std::unordered_map<std::string, std::string> locale_;

    struct Session {
        EntityId              hostId = 0;
        std::string           dialogId;
        std::string           currentNodeId;
        DialogWaitPhase       phase = DialogWaitPhase::None;
        TypewriterState       typewriter;
        int                   selectedChoice = 0;
        float                 textSpeed    = 40.f;
        std::unordered_set<std::string> visitedNodes;
        uint32_t              pauseToken = 0;
    };
    std::optional<Session> session_;

    const DialogNode* currentNode() const;
    std::string resolveLineText(const DialogNode& node) const;
    void advanceToNode(const std::string& nodeId);
    void processInstantNodes();
    bool handleInput();
    void markVisited(const std::string& nodeId);
    bool evaluateCondition(const DialogNode& node) const;
    void applySetVariable(const DialogNode& node);
};

} // namespace Modules
} // namespace ArtCade
