#include "object-type-materialize.h"

#include <algorithm>
#include <iostream>
#include <unordered_map>
#include <unordered_set>

namespace ArtCade {

EntityDef materializeInstance(const EntityDef& typeProto,
                              const SceneInstanceDef& instance) {
    EntityDef e = typeProto;
    e.id        = instance.id;
    e.className = typeProto.className.empty() ? instance.objectTypeId : typeProto.className;
    e.name      = instance.instanceName.empty() ? typeProto.name : instance.instanceName;
    e.transform = instance.transform;
    e.visible   = instance.visible;
    e.layerId   = instance.layerId;
    e.localVariableOverrides = instance.localVariableOverrides;
    if (instance.spriteRendererOverride) {
        const SpriteRendererOverride& delta = *instance.spriteRendererOverride;
        if (delta.capabilityEnabled && !*delta.capabilityEnabled) {
            e.spriteRenderer.reset();
        } else if (e.spriteRenderer) {
            if (delta.imageAssetId) e.spriteRenderer->imageAssetId = *delta.imageAssetId;
            if (delta.visible) e.spriteRenderer->visible = *delta.visible;
        }
    }
    if (instance.spriteAnimatorOverride) {
        const SpriteAnimatorOverride& delta = *instance.spriteAnimatorOverride;
        if (delta.capabilityEnabled && !*delta.capabilityEnabled) {
            e.spriteAnimator.reset();
        } else if (e.spriteAnimator) {
            if (delta.animationAssetId)
                e.spriteAnimator->animationAssetId = *delta.animationAssetId;
            if (delta.defaultClipId)
                e.spriteAnimator->defaultClipId = *delta.defaultClipId;
            if (delta.autoPlay) e.spriteAnimator->autoPlay = *delta.autoPlay;
            if (delta.playbackSpeed) e.spriteAnimator->playbackSpeed = *delta.playbackSpeed;
        }
    }
    if (e.spriteRenderer) {
        e.visible = e.visible && e.spriteRenderer->visible;
        if (!e.spriteRenderer->imageAssetId.empty())
            e.sprite.spriteAssetId = e.spriteRenderer->imageAssetId;
    }
    return e;
}

void materializeProjectEntities(ProjectDoc& doc) {
    if (doc.objectTypes.empty()) return;

    const bool hasInstances = std::any_of(
        doc.scenes.begin(), doc.scenes.end(),
        [](const auto& kv) { return !kv.second.instances.empty(); });
    if (!hasInstances && !doc.entities.empty()) return;

    // The editor always ships `entities` as a derived cache next to
    // objectTypes+instances, so overlapping ids are the normal case. Only warn
    // about entity ids no instance accounts for — those are true legacy leftovers.
    if (hasInstances && !doc.entities.empty()) {
        std::unordered_set<EntityId> instanceIds;
        for (const auto& [sid, scene] : doc.scenes) {
            (void)sid;
            for (const SceneInstanceDef& inst : scene.instances)
                instanceIds.insert(inst.id);
        }
        size_t legacyOnly = 0;
        for (const auto& [id, def] : doc.entities) {
            (void)def;
            if (instanceIds.find(id) == instanceIds.end())
                ++legacyOnly;
        }
        if (legacyOnly > 0) {
            std::cerr << "[Project] Warning: " << legacyOnly
                      << " legacy entity definition(s) have no matching scene "
                         "instance; they will be kept as-is while instance IDs "
                         "override matching entries.\n";
        }
    }

    for (auto& [sid, scene] : doc.scenes) {
        if (scene.instances.empty()) continue;
        scene.entityIds.clear();
        for (const SceneInstanceDef& inst : scene.instances) {
            auto typeIt = doc.objectTypes.find(inst.objectTypeId);
            if (typeIt == doc.objectTypes.end()) {
                std::cerr << "[Project] Unknown objectTypeId \"" << inst.objectTypeId
                          << "\" for instance id " << inst.id << " — skipped.\n";
                continue;
            }
            EntityDef e = materializeInstance(typeIt->second, inst);
            doc.entities[e.id] = e;
            scene.entityIds.push_back(e.id);
        }
        (void)sid;
    }
}

void rebuildClassPrototypes(
    std::unordered_map<std::string, EntityDef>& out,
    const std::unordered_map<std::string, EntityDef>& objectTypes,
    const std::unordered_map<EntityId, EntityDef>& entityDefs)
{
    out.clear();
    for (const auto& [typeId, def] : objectTypes) {
        EntityDef copy = def;
        copy.className = typeId;
        out[typeId] = std::move(copy);
    }
    for (const auto& [id, def] : entityDefs) {
        (void)id;
        if (def.className.empty()) continue;
        if (out.find(def.className) == out.end())
            out[def.className] = def;
    }
}

void resolveSpritePivotsFromImageAssets(ProjectDoc& doc) {
    if (doc.imageAssets.empty()) return;

    std::unordered_map<std::string, Vec2> pivotByPath;
    for (const ImageAssetDef& ad : doc.imageAssets)
        pivotByPath[ad.assetId] = ad.defaultPivot;

    const auto apply = [&](EntityDef& e) {
        if (!e.sprite.pivotFromAsset) return;
        const auto it = pivotByPath.find(e.sprite.spriteAssetId);
        e.sprite.pivot = it != pivotByPath.end() ? it->second : Vec2{0.5f, 0.5f};
    };

    for (auto& [_, e] : doc.entities)
        apply(e);
    for (auto& [_, t] : doc.objectTypes)
        apply(t);
}

} // namespace ArtCade
