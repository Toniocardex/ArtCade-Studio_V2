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
//   • represent `tilemap.data` as a cheap XOR+sum hash (`dh`) so that tile
//     paints from the TilesetEditorModal trigger a re-sync without serialising
//     the full array on every fingerprint call (cols/rows/tilesetAssetId kept);
//   • be cheap to compute and stable across equal projects (object key order
//     is normalised by sorting entity / scene ids).
//
// The current implementation builds a small JSON projection and stringifies it.
// For an MVP this is enough: a 100-entity scene serialises in < 1 ms on the
// dev machine and only happens after the store actually changed.

import type { EntityDef, ProjectDoc, SceneDef, Vec2, Vec4, WorldSettings } from '../types'
import { DEFAULT_WORLD } from '../types'
import { resolveClipForEntity } from './entity-clip-resolve'
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
  tx?: unknown               // text label
  gg?: unknown               // gauge
  lv?: unknown               // local variable declarations
  lvo?: unknown              // per-instance local overrides
}

interface FpTilemap {
  ts:  number                // tileSize
  c:   number                // cols
  r:   number                // rows
  set?: string               // tilesetAssetId
  dh?: number                // data hash (XOR+sum of painted cells — detects tile paints)
}

interface FpTilemapLayer {
  ts:  number
  c:   number
  r:   number
  set?: string
  dh?: number
}

interface FpScene {
  id:  string
  ws:  FpVec2                // worldSize
  vs:  FpVec2                // viewportSize
  bg:  FpVec4                // backgroundColor
  e:   number[]              // entityIds (sorted)
  tm?: FpTilemap
  /** Per-layer paint grids (when scene uses tilemapLayers). */
  tl?: Record<string, FpTilemapLayer>
}

export interface RuntimeProjection {
  pn: string                 // projectName
  pv: string                 // version
  as: string                 // activeSceneId
  fps: number                // targetFPS
  /** World settings consumed by WASM (gravity, physicsMode, physicsDebugDraw, …). */
  wd: string
  msp: string                // mainScriptPath
  gv?: unknown               // project variable declarations
  /** Render stack names (index 0 = highest priority). */
  lyr: string[]
  entities: FpEntity[]
  scenes: FpScene[]
}

/** Stable digest of runtime-facing WorldSettings (excludes editor-only flags). */
export function worldRuntimeDigest(world?: WorldSettings): string {
  const w = { ...DEFAULT_WORLD, ...world }
  return JSON.stringify({
    g: w.gravity,
    ppm: w.pixelsPerMeter,
    ts: w.timeScale,
    pm: w.physicsMode ?? 'auto',
    pdb: w.physicsDebugDraw === true,
  })
}

/** TypeScript contract mirrored by C++ `ProjectRuntimeSettings` (see types.h). */
export type ProjectRuntimeSettings = {
  targetFPS: number
  physicsMode: NonNullable<ProjectDoc['world']>['physicsMode']
}

function v2(v: Vec2): FpVec2 { return { x: v.x, y: v.y } }
function v3(v: { x: number; y: number; z: number }): FpVec3 { return { x: v.x, y: v.y, z: v.z } }
function v4(v: Vec4): FpVec4 { return { x: v.x, y: v.y, z: v.z, w: v.w } }

function projectEntity(project: ProjectDoc, e: EntityDef): FpEntity {
  const t = e.transform
  const s = e.sprite
  const clip = resolveClipForEntity(project, e.id, e)
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
      ...(clip?.defaultClip ? { dc: clip.defaultClip } : {}),
      ...(clip?.playClipOnSpawn ? { ps: true } : {}),
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
    tx: e.text,
    gg: e.gauge,
    lv: e.localVariables,
    lvo: e.localVariableOverrides,
  }
}

/** Position-dependent FNV-1a hash of tilemap cell data. Order-sensitive: swapping
 *  two non-equal tiles produces a different hash, preventing stale WASM renders. */
function tilemapDataHash(data: number[]): number {
  let h = 2166136261
  for (let i = 0; i < data.length; i++) {
    h = Math.imul(h ^ (data[i] * 2654435761 + i), 16777619)
  }
  return h >>> 0
}

function projectScene(s: SceneDef): FpScene {
  const tm = s.tilemap
  const layers = s.tilemapLayers
  let tl: Record<string, FpTilemapLayer> | undefined
  if (layers && Object.keys(layers).length > 0) {
    tl = {}
    for (const [name, layer] of Object.entries(layers)) {
      tl[name] = {
        ts:  layer.tileSize,
        c:   layer.cols,
        r:   layer.rows,
        set: layer.tilesetAssetId,
        dh:  layer.data.length > 0 ? tilemapDataHash(layer.data) : undefined,
      }
    }
  }
  return {
    id: s.id,
    ws: v2(s.worldSize),
    vs: v2(s.viewportSize),
    bg: v4(s.backgroundColor),
    e:  [...s.entityIds].sort((a, b) => a - b),
    tm: tm ? {
      ts:  tm.tileSize,
      c:   tm.cols,
      r:   tm.rows,
      set: tm.tilesetAssetId,
      dh:  tm.data.length > 0 ? tilemapDataHash(tm.data) : undefined,
    } : undefined,
    tl,
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
    wd:  worldRuntimeDigest(project.world),
    msp: project.mainScriptPath,
    gv: project.globalVariables,
    lyr: (project.layers ?? []).map((layer) => layer.name),
    entities: entityIds.map((id) => projectEntity(project, entities[id])),
    scenes:   sceneIds.map((id) => projectScene(project.scenes[id])),
  }
}

/**
 * Stable string fingerprint of the runtime-affecting subset of a ProjectDoc.
 * Two ProjectDocs that produce the same fingerprint do not need a re-sync
 * into the C++ runtime (`editor_load_project`).
 *
 * `tilemap.data` is represented as a cheap XOR+sum hash (`dh`) so tile paints
 * from the TilesetEditorModal trigger a re-sync without flooding on large arrays.
 * Excluded: `thumbnails`, `logicBoards` (compiled by save pipeline), `licenseTier`.
 * World settings via `wd`.
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
  globalVariables?: ProjectDoc['globalVariables']
  entities:       ProjectDoc['entities']
  objectTypes?:   ProjectDoc['objectTypes']
  scenes:         ProjectDoc['scenes']
  layers?:        ProjectDoc['layers']
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
    globalVariables: project.globalVariables,
    entities,
    ...(project.objectTypes && Object.keys(project.objectTypes).length > 0
      ? { objectTypes: project.objectTypes }
      : {}),
    scenes:         project.scenes,
    layers:         project.layers,
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
