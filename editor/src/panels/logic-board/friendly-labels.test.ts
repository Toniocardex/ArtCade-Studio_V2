import { describe, expect, it } from 'vitest'
import {
  actionDisplayName,
  actionSummaryPlain,
  boardDisplayName,
  enumDisplayLabel,
  triggerDisplayName,
  triggerSummaryPlain,
} from './friendly-labels'
import type { ProjectDoc } from '../../types'
import type { LogicBoard } from '../../types/logic-board'

function miniProject(): ProjectDoc {
  return {
    projectName: 'T',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: {
      1: {
        id: 1, name: 'Hero', className: 'Player', tags: [],
        transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, fillColor: { x: 1, y: 1, z: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
      },
    },
    scenes: {
      s: {
        id: 's', name: 'S', worldSize: { x: 1280, y: 720 }, viewportSize: { x: 1280, y: 720 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 }, entityIds: [1],
      },
    },
  }
}

describe('friendly-labels', () => {
  it('uses plain trigger names', () => {
    expect(triggerDisplayName('onInput')).toBe('Keyboard key')
    expect(triggerDisplayName('onCollisionEnter')).toBe('Starts touching type')
    expect(triggerDisplayName('onCollisionExit')).toBe('Stops touching type')
    expect(triggerDisplayName('onMouseInput')).toBe('Mouse button')
    expect(triggerDisplayName('onObjectClick')).toBe('Object clicked')
    expect(triggerDisplayName('onObjectHoverEnter')).toBe('Pointer enters object')
    expect(triggerDisplayName('onObjectHoverExit')).toBe('Pointer leaves object')
    expect(triggerDisplayName('onMessage')).toBe('Game message')
    expect(actionDisplayName('spawnEntity')).toBe('Create object')
    expect(actionDisplayName('spawnEntityAtPointer')).toBe('Create at pointer')
    expect(actionDisplayName('controllerMovement')).toBe('Set direction')
    expect(actionDisplayName('moveController')).toBe('Set fixed direction')
  })

  it('labels Set Flip per-axis modes with result-oriented text', () => {
    expect(enumDisplayLabel('action:setFlip:flipX', 'keep')).toBe("Don't change")
    expect(enumDisplayLabel('action:setFlip:flipX', 'normal')).toBe('Normal (right)')
    expect(enumDisplayLabel('action:setFlip:flipX', 'mirror')).toBe('Mirrored (left)')
    expect(enumDisplayLabel('action:setFlip:flipX', 'toggle')).toBe('Toggle')
    expect(enumDisplayLabel('action:setFlip:flipY', 'mirror')).toBe('Mirrored')
  })

  it('summarizes Set Flip per axis (mode-aware)', () => {
    expect(actionSummaryPlain(
      { type: 'setFlip', target: 'self', flipX: 'mirror', flipY: 'keep' },
    )).toContain('X mirror')
    expect(actionSummaryPlain(
      { type: 'setFlip', target: 'self', flipX: 'keep', flipY: 'keep' },
    )).toContain('no change')
  })

  it('summarizes Space key press in plain English', () => {
    const s = triggerSummaryPlain({
      type: 'onInput',
      keyCode: 'Space',
      eventType: 'pressed',
    })
    expect(s).toContain('presses')
    expect(s).toContain('Space')
    expect(s).not.toContain('onInput')
  })

  it('summarizes spawn coin without camelCase', () => {
    const s = actionSummaryPlain({
      type: 'spawnEntity',
      className: 'coin',
      x: 25,
      y: 25,
    })
    expect(s).toContain('Create')
    expect(s).toContain('coin')
    expect(s).not.toContain('spawnEntity')
  })

  it('prompts when spawn class is not chosen', () => {
    const s = actionSummaryPlain({
      type: 'spawnEntity',
      className: '',
      x: 0,
      y: 0,
    })
    expect(s).toContain('choose what to create')
    expect(s).not.toContain('?')
  })

  it('summarizes pointer spawn without camelCase', () => {
    const s = actionSummaryPlain({
      type: 'spawnEntityAtPointer',
      className: 'coin',
    })
    expect(s).toContain('Create')
    expect(s).toContain('pointer')
    expect(s).not.toContain('spawnEntityAtPointer')
  })

  it('board display shows the compiler label for shared type boards', () => {
    const board: LogicBoard = {
      boardId: 'board_mpe2dp1j_1',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [],
    }
    expect(boardDisplayName(board, miniProject())).toBe('board_mpe2dp1j_1')
  })

  it('board display shows the compiler label for unnamed boards', () => {
    const board: LogicBoard = {
      boardId: 'board_hero',
      target: { type: 'object_type', objectTypeId: 'Player' },
      events: [],
    }
    expect(boardDisplayName(board, miniProject())).toBe('board_hero')
  })
})
