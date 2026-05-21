// ---------------------------------------------------------------------------
// project.blank.test — File → New Project template
// ---------------------------------------------------------------------------
//
// Guarantees we want from createBlankProject():
//   1. The returned doc is *minimal but valid* — at least one scene that
//      matches activeSceneId, no entities, well-formed defaults.
//   2. It survives a serialize → parse round-trip (= it can be saved to
//      disk and reopened without data loss).
//   3. The default content used to scaffold scripts/main.lua is valid Lua
//      that defines the tick(dt) callback the runtime calls every frame.

import { describe, it, expect } from 'vitest'
import {
  createBlankProject,
  BLANK_MAIN_LUA,
  parseProjectDoc,
  serializeProjectDoc,
} from './project'

describe('createBlankProject', () => {
  it('returns a minimal but valid ProjectDoc', () => {
    const p = createBlankProject('Test Game')

    expect(p.projectName).toBe('Test Game')
    expect(p.licenseTier).toBe('free')
    expect(p.targetFPS).toBe(60)
    expect(p.mainScriptPath).toBe('scripts/main.lua')

    // No entities by default — the Scenes panel starts empty.
    expect(Object.keys(p.entities)).toHaveLength(0)

    // Exactly one scene that matches activeSceneId.
    const scenes = Object.values(p.scenes)
    expect(scenes).toHaveLength(1)
    expect(p.activeSceneId).toBe(scenes[0].id)
    expect(scenes[0].entityIds).toEqual([])

    // Non-zero world & viewport (otherwise the editor camera divides by 0).
    expect(scenes[0].worldSize.x).toBeGreaterThan(0)
    expect(scenes[0].worldSize.y).toBeGreaterThan(0)
    expect(scenes[0].viewportSize.x).toBeGreaterThan(0)
    expect(scenes[0].viewportSize.y).toBeGreaterThan(0)

    // logicBoards present (empty) so reducers can push without null checks.
    expect(Array.isArray(p.logicBoards)).toBe(true)
    expect(p.logicBoards).toHaveLength(0)
  })

  it('defaults projectName to "Untitled" when no name is provided', () => {
    expect(createBlankProject().projectName).toBe('Untitled')
  })

  it('survives a serialize → parse round-trip', () => {
    // This is THE invariant for Save As: whatever we ship to disk must come
    // back identically through the same parser the runtime uses.
    const before = createBlankProject('Round Trip')
    const json   = serializeProjectDoc(before)
    const after  = parseProjectDoc(json)

    expect(after).not.toBeNull()
    expect(after!.projectName).toBe(before.projectName)
    expect(after!.activeSceneId).toBe(before.activeSceneId)
    expect(after!.mainScriptPath).toBe(before.mainScriptPath)
    expect(after!.targetFPS).toBe(before.targetFPS)
    expect(Object.keys(after!.scenes)).toEqual(Object.keys(before.scenes))
    expect(Object.keys(after!.entities)).toHaveLength(0)
  })

  it('blank instances do not share state (no aliasing of nested objects)', () => {
    const a = createBlankProject('A')
    const b = createBlankProject('B')

    a.scenes.scene_main.entityIds.push(42)
    expect(b.scenes.scene_main.entityIds).toEqual([])

    a.scenes.scene_main.worldSize.x = 100
    expect(b.scenes.scene_main.worldSize.x).toBe(1280)
  })
})

describe('BLANK_MAIN_LUA', () => {
  it('defines the tick(dt) entry point the runtime expects', () => {
    expect(BLANK_MAIN_LUA).toMatch(/function\s+tick\s*\(\s*dt\s*\)/)
    expect(BLANK_MAIN_LUA).toMatch(/end\s*$/m)
  })
})
