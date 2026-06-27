#pragma once



#include "scene-lifecycle-result.h"



#include <functional>



namespace ArtCade::Modules {



class SceneManager;

class SceneMutationService;



using SceneActivationSyncFn = std::function<void()>;

using SceneTransitionHandlerFn = std::function<void(const SceneTransitionResult&)>;
/** Clears per-scene gameplay runtime state after activation (World maps, camera follow, …). */
using SceneGameplayResetFn = std::function<void()>;



/**

 * Owns scene load, restart, and fade transitions.

 * Patches SceneDef authoring stay in SceneMutationService.

 */

class SceneLifecycleService {

public:

    SceneLifecycleService(

        SceneManager& scenes,

        SceneMutationService& mutations,

        SceneActivationSyncFn activationSync);



    /**

     * Registers a handler invoked after each successful scene commit (immediate or

     * mid-fade). Used by Application to coalesce invalidation flags.

     */

    void set_transition_handler(SceneTransitionHandlerFn handler);

    /** Invoked synchronously after entity activation on each successful commit. */
    void set_gameplay_reset_handler(SceneGameplayResetFn handler);



    /** Loads @p sceneId immediately (no fade). */

    SceneTransitionResult load_immediate(const SceneId& sceneId);



    /**

     * Loads @p sceneId, optionally with a fade-out / fade-in transition.

     * @p fadeSeconds <= 0 behaves like load_immediate().

     */

    SceneTransitionResult request_load(const SceneId& sceneId, float fadeSeconds);



    /** Re-activates the active scene (sync + gameplay reset). Does not restore authored layout. */
    SceneTransitionResult request_reactivate(float fadeSeconds);

    /** @deprecated Use request_reactivate(); does not restore destroyed/spawned entities. */
    SceneTransitionResult request_restart(float fadeSeconds);



    /** Advances an in-flight fade transition; commits load at fade midpoint. */

    void tick(float dt);



    /** 0 = no overlay, 1 = full black (fade midpoint). */

    float scene_fade_alpha() const;



    /** @return true while a fade transition is in progress. */

    bool transition_active() const;



    /** Cancels fade state (e.g. gateway shutdown). */

    void cancel_transition();



private:

    enum class FadePhase { None, Out, In };



    bool commit_load(const SceneId& sceneId, SceneTransitionResult& out);

    SceneTransitionResult make_success(const SceneId& sceneId);

    void notify_transition(const SceneTransitionResult& result);



    SceneManager& scenes_;

    SceneMutationService& mutations_;

    SceneActivationSyncFn activationSync_;

    SceneTransitionHandlerFn transitionHandler_;
    SceneGameplayResetFn gameplayReset_;



    SceneId pendingSceneId_;

    float fadeDuration_ = 0.f;

    float fadeElapsed_ = 0.f;

    FadePhase fadePhase_ = FadePhase::None;

};



} // namespace ArtCade::Modules

