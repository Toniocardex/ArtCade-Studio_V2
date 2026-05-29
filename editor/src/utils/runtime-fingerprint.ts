// ---------------------------------------------------------------------------
// runtime-fingerprint — decide when to push a full ProjectDoc into the runtime
// ---------------------------------------------------------------------------
//
// `PreviewPanel` used to assemble a hand-rolled "loadKey" with a tiny subset
// of fields. As the editor grew (Inspector sprite tint, components, className,
// etc.) more user-visible changes were silently NOT reflected in the runtime
// because they weren't in the key (P2 in TECHNICAL_DEBT_REVIEW.md).
//
// This module centralises that decision. The fingerprint must:
//   • include every field the C++ runtime actually consumes from ProjectDoc;
//   • EXCLUDE `tilemap.data` — during interactive paint the runtime is the
//     source of truth and re-loading the whole project on every cell would
//     flood `editor_load_project` (the structure — cols/rows/tilesetAssetId —
//     IS included so attaching a tileset re-syncs once);
//   • be cheap to compute and stable across equal projects (object key order
//     is normalised by sorting entity / scene ids).
//
// The current implementation builds a small JSON projection and stringifies it.
// For an MVP this is enough: a 100-entity scene serialises in < 1 ms on the
// dev machine and only happens after the store actually changed.

import type { EntityDef, ProjectDoc, SceneDef, Vec2, Vec4 } from '../types'
import { entitiesForRuntimeSync } from './project-object-types'

interface FpVec2 { x: number; y: number }
interface FpVec3 { x: number; y: number; z: number }
interface FpVec4 { x: number; y: number; z: number; w: number }

interface FpTransform {
  px: number; py: number
  r:  number
  sx: number; sy: number
}

interface FpSprite {
  a: string                  // spriteAssetId
  t: FpVec4                  // tint
  fc: FpVec3                 // fillColor
  o: number                  // alpha
  p: FpVec2                  // pivot
  z: number                  // renderOrder
  dc?: string                // defaultClip
  ps?: boolean               // playClipOnSpawn
}

interface FpEntity {
  id: number
  n:  string                 // name
  c:  string                 // className
  g:  string[]               // tags (sorted)
  t:  FpTransform
  s:  FpSprite
  v?: boolean                // visibility (editor-only but affects runtime drawing)
  sp?: string                // scriptPath
  ph?: unknown               // physics — opaque, full snapshot
  se?: unknown               // sensor
  so?: unknown               // solid
  pc?: unknown               // platformerController
  td?: unknown               // topDownController
  lm?: unknown               // linearMover
  ct?: unknown               // cameraTarget
  mi?: unknown               // magneticItem
  hm?: unknown               // hordeMember
  he?: unknown               // health
  ad?: unknown               // autoDestroy
  dg?: unknown               // dialog
}

interface FpTilemap {
  ts:  number                // tileSize
  c:   number                // cols
  r:   number                // rows
  set?: string               // tilesetAssetId
}

interface FpScene {
  id:  string
  ws:  FpVec2                // worldSize
  vs:  FpVec2                // viewportSize
  bg:  FpVec4                // backgroundColor
  e:   number[]              // entityIds (sorted)
  tm?: FpTilemap
}

export interface RuntimeProjection {
  pn: string                 // projectName
  pv: string                 // version
  as: string                 // activeSceneId
  fps: number                // targetFPS
  pm: string                 // world.physicsMode (auto | on | off)
  msp: string                // mainScriptPath
  entities: FpEntity[]
  scenes: FpScene[]
}

/** TypeScript contract mirrored by C++ `ProjectRuntimeSettings` (see types.h). */
export type ProjectRuntimeSettings = {
  targetFPS: number
  physicsMode: NonNullable<ProjectDoc['world']>['physicsMode']
}

function v2(v: Vec2): FpVec2 { return { x: v.x, y: v.y } }
function v3(v: { x: number; y: number; z: number }): FpVec3 { return { x: v.x, y: v.y, z: v.z } }
function v4(v: Vec4): FpVec4 { return { x: v.x, y: v.y, z: v.z, w: v.w } }

function projectEntity(e: EntityDef): FpEntity {
  const t = e.transform
  const s = e.sprite
  return {
    id: e.id,
    n:  e.name,
    c:  e.className,
    g:  [...e.tags].sort(),
    t:  { px: t.position.x, py: t.position.y, r: t.rotation, sx: t.scale.x, sy: t.scale.y },
    s:  {
      a: s.spriteAssetId,
      t: v4(s.tint),
      fc: v3(s.fillColor),
      o: s.alpha,
      p: v2(s.pivot),
      z: s.renderOrder,
      ...(s.defaultClip?.trim() ? { dc: s.defaultClip.trim() } : {}),
      ...(s.playClipOnSpawn === true ? { ps: true } : {}),
    },
    v:  e.visible,
    sp: e.scriptPath,
    ph: e.physics,
    se: e.sensor,
    so: e.solid,
    pc: e.platformerController,
    td: e.topDownController,
    lm: e.linearMover,
    ct: e.cameraTarget,
    mi: e.magneticItem,
    hm: e.hordeMember,
    he: e.health,
    ad: e.autoDestroy,
    dg: e.dialog,
  }
}

function projectScene(s: SceneDef): FpScene {
  const tm = s.tilemap
  return {
    id: s.id,
    ws: v2(s.worldSize),
    vs: v2(s.viewportSize),
    bg: v4(s.backgroundColor),
    e:  [...s.entityIds].sort((a, b) => a - b),
    tm: tm ? { ts: tm.tileSize, c: tm.cols, r: tm.rows, set: tm.tilesetAssetId } : undefined,
  }
}

/**
 * Build a JSON-serializable projection of the runtime-affecting subset of a
 * ProjectDoc. Exported for testing; production callers should use
 * {@link runtimeProjectFingerprint} which returns the stringified form.
 */
export function runtimeProjectProjection(
  project: ProjectDoc,
  activeSceneId: string,
): RuntimeProjection {
  const entities = entitiesForRuntimeSync(project)
  const entityIds = Object.keys(entities).map(Number).sort((a, b) => a - b)
  const sceneIds  = Object.keys(project.scenes).sort()
  return {
    pn:  project.projectName,
    pv:  project.version,
    as:  activeSceneId,
    fps: project.targetFPS,
    pm:  project.world?.physicsMode ?? 'auto',
    msp: project.mainScriptPath,
    entities: entityIds.map((id) => projectEntity(entities[id])),
    scenes:   sceneIds.map((id) => projectScene(project.scenes[id])),
  }
}

/**
 * Stable string fingerprint of the runtime-affecting subset of a ProjectDoc.
 * Two ProjectDocs that produce the same fingerprint do not need a re-sync
 * into the C++ runtime (`editor_load_project`).
 *
 * Excluded by design: `tilemap.data` (live painting echoes through React
 * separately), `thumbnails`, `logicBoards` (compiled by the save pipeline
 * before reaching the runtime), `licenseTier`. Physics mode is included via `pm`.
 */
export function runtimeProjectFingerprint(
  project: ProjectDoc,
  activeSceneId: string,
): string {
  return JSON.stringify(runtimeProjectProjection(project, activeSceneId))
}

/**
 * Fields the C++ editor bridge reads from `editor_load_project` / restore.
 * Keep in sync with `ProjectRuntimeSettings` in runtime-cpp/src/core/types.h.
 */
export interface RuntimeProjectPayload {
  projectName:    string
  version:        string
  targetFPS:      number
  mainScriptPath: string
  licenseTier?:   string
  world?:         ProjectDoc['world']
  entities:       ProjectDoc['entities']
  objectTypes?:   ProjectDoc['objectTypes']
  scenes:         ProjectDoc['scenes']
  tilePalette?:   ProjectDoc['tilePalette']
  tilesets?:      ProjectDoc['tilesets']
  activeSceneId:  string
}

/**
 * JSON blob for the WASM bridge — runtime-affecting ProjectDoc fields only.
 * Omits editor-only data (`logicBoards`, `assets`, thumbnails, …).
 */
export function runtimeProjectPayload(
  project: ProjectDoc,
  activeSceneId: string,
): RuntimeProjectPayload {
  const entities = entitiesForRuntimeSync(project)
  return {
    projectName:    project.projectName,
    version:        project.version,
    targetFPS:      project.targetFPS,
    mainScriptPath: project.mainScriptPath,
    licenseTier:    project.licenseTier,
    world:          project.world,
    entities,
    ...(project.objectTypes && Object.keys(project.objectTypes).length > 0
      ? { objectTypes: project.objectTypes }
      : {}),
    scenes:         project.scenes,
    tilePalette:    project.tilePalette,
    tilesets:       project.tilesets,
    activeSceneId,
  }
}

export function projectJsonForRuntime(
  project: ProjectDoc,
  activeSceneId: string,
): string {
  return JSON.stringify(runtimeProjectPayload(project, activeSceneId))
}
