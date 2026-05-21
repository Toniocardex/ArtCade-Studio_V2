import { describe, expect, it } from 'vitest'
import {
  actionDisplayName,
  actionSummaryPlain,
  boardDisplayName,
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
        sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
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
    expect(triggerDisplayName('onInput')).toBe('Key pressed')
    expect(actionDisplayName('spawnEntity')).toBe('Create object')
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

  it('board display shows class label for shared class boards', () => {
    const board: LogicBoard = {
      boardId: 'board_mpe2dp1j_1',
      target: { type: 'entity_class', className: 'Player' },
      events: [],
    }
    expect(boardDisplayName(board, miniProject())).toContain('[class]')
    expect(boardDisplayName(board, miniProject())).toContain('Hero')
  })

  it('board display shows entity name for entity_id boards', () => {
    const board: LogicBoard = {
      boardId: 'board_hero',
      target: { type: 'entity_id', entityId: 1 },
      events: [],
    }
    expect(boardDisplayName(board, miniProject())).toBe('Hero')
  })
})
