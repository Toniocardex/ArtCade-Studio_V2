#pragma once

#include "types.h"

#include <string>

namespace ArtCade {

// Single gameplay mutation/query boundary shared by generated Logic programs
// and manual Script programs. Implementations belong to the materialized
// runtime (Editor Play or standalone game), never to either language runtime.
class IGameplayRuntimeHost {
public:
    virtual ~IGameplayRuntimeHost() = default;
    virtual bool setVisible(EntityId owner, bool value) = 0;
    virtual bool setPosition(EntityId owner, Vec2 value) = 0;
    virtual bool translate(EntityId owner, Vec2 delta) = 0;
    virtual bool isGrounded(EntityId owner) = 0;
    virtual bool requestPlatformerMove(EntityId owner, float axis) = 0;
    virtual bool requestPlatformerJump(EntityId owner) = 0;
    virtual bool isObjectType(EntityId entity, const ObjectTypeId& objectTypeId) = 0;
    virtual bool requestDestroy(EntityId owner) = 0;
    virtual bool playAnimationClip(EntityId owner, const AssetId& animationAssetId,
                                   const std::string& clipId) = 0;
    virtual bool stopAnimation(EntityId owner) = 0;
    virtual bool setAnimationPlaybackSpeed(EntityId owner, float speed) = 0;
    virtual bool playSound(EntityId owner, const AssetId& audioAssetId, float volume) = 0;
};

} // namespace ArtCade
