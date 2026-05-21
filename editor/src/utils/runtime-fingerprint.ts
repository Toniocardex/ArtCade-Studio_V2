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

interface FpVec2 { x: number; y: number }
interface FpVec4 { x: number; y: number; z: number; w: number }

interface FpTransform {
  px: number; py: number
  r:  number
  sx: number; sy: number
}

interface FpSprite {
  a: string                  // spriteAssetId
  t: FpVec4                  // tint
  o: number                  // alpha
  p: FpVec2                  // pivot
  z: number                  // renderOrder
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
  pc?: unknown               // platformerController
  he?: unknown               // health
  ad?: unknown               // autoDestroy
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

interface RuntimeProjection {
  pn: string                 // projectName
  pv: string                 // version
  as: string                 // activeSceneId
  res: FpVec2                // gameResolution
  fps: number                // targetFPS
  msp: string                // mainScriptPath
  entities: FpEntity[]
  scenes: FpScene[]
}

function v2(v: Vec2): FpVec2 { return { x: v.x, y: v.y } }
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
    s:  { a: s.spriteAssetId, t: v4(s.tint), o: s.alpha, p: v2(s.pivot), z: s.renderOrder },
    v:  e.visible,
    sp: e.scriptPath,
    ph: e.physics,
    se: e.sensor,
    pc: e.platformerController,
    he: e.health,
    ad: e.autoDestroy,
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
  const entityIds = Object.keys(project.entities).map(Number).sort((a, b) => a - b)
  const sceneIds  = Object.keys(project.scenes).sort()
  return {
    pn:  project.projectName,
    pv:  project.version,
    as:  activeSceneId,
    res: v2(project.gameResolution),
    fps: project.targetFPS,
    msp: project.mainScriptPath,
    entities: entityIds.map((id) => projectEntity(project.entities[id])),
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
 * before reaching the runtime), `licenseTier`, `world` (Box2D settings — TODO
 * once the runtime reads them dynamically).
 */
export function runtimeProjectFingerprint(
  project: ProjectDoc,
  activeSceneId: string,
): string {
  return JSON.stringify(runtimeProjectProjection(project, activeSceneId))
}
