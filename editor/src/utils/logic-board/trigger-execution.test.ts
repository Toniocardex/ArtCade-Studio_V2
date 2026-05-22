import { describe, expect, it } from 'vitest'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
import type { ProjectDoc } from '../../types'
import {
  canRegisterLifecycleDestroy,
  canRegisterLifecycleSpawn,
  getTriggerExecutionMode,
  triggerPickerGroup,
  usesTickFallback,
} from './trigger-execution'

function board(
  target: LogicBoard['target'],
  events: LogicEvent[] = [],
): LogicBoard {
  return { boardId: 'b1', target, events }
}

function ev(trigger: LogicEvent['trigger']): LogicEvent {
  return { id: 'e1', enabled: true, trigger, actions: [] }
}

describe('trigger-execution', () => {
  it('classifies polling trigger types', () => {
    expect(triggerPickerGroup('onUpdate')).toBe('Advanced / Polling')
    expect(triggerPickerGroup('onSpawn')).toBe('Recommended')
  })

  it('onInput pressed is event, down is polling', () => {
    const b = board({ type: 'entity_class', className: 'Player' })
    const pressed = ev({
      type: 'onInput',
      keyCode: 'Space',
      eventType: 'pressed',
    })
    const down = ev({ type: 'onInput', keyCode: 'Space', eventType: 'down' })
    expect(usesTickFallback(pressed, b)).toBe(false)
    expect(usesTickFallback(down, b)).toBe(true)
    expect(getTriggerExecutionMode(pressed.trigger)).toBe('event')
    expect(getTriggerExecutionMode(down.trigger)).toBe('polling')
  })

  it('onDestroy uses event when board targets a class', () => {
    const b = board({ type: 'entity_class', className: 'Enemy' })
    const event = ev({ type: 'onDestroy' })
    expect(canRegisterLifecycleDestroy(event, b)).toBe(true)
    expect(usesTickFallback(event, b)).toBe(false)
  })

  it('onDestroy falls back to polling for entity_id boards without class', () => {
    const b = board({ type: 'entity_id', entityId: 1 })
    const event = ev({ type: 'onDestroy' })
    expect(canRegisterLifecycleDestroy(event, b)).toBe(false)
    expect(usesTickFallback(event, b)).toBe(true)
  })

  it('onSpawn uses event when className set on trigger', () => {
    const b = board({ type: 'entity_id', entityId: 1 })
    const event = ev({ type: 'onSpawn', className: 'Bullet' })
    expect(canRegisterLifecycleSpawn(event, b)).toBe(true)
    expect(usesTickFallback(event, b)).toBe(false)
  })

  it('onDestroy on entity_id board resolves class from project', () => {
    const b = board({ type: 'entity_id', entityId: 1 })
    const event = ev({ type: 'onDestroy' })
    const project = {
      projectName: 'T',
      version: '2.0.0',
      targetFPS: 60,
      activeSceneId: 's',
      mainScriptPath: 'scripts/main.lua',
      entities: {
        1: {
          id: 1, name: 'H', className: 'Player', tags: [],
          transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0 },
          sprite: { spriteAssetId: '', tint: { x: 1, y: 1, z: 1, w: 1 }, alpha: 1, pivot: { x: 0.5, y: 0.5 }, renderOrder: 0 },
        },
      },
      scenes: {},
    } satisfies ProjectDoc
    expect(canRegisterLifecycleDestroy(event, b, project)).toBe(true)
    expect(usesTickFallback(event, b, project)).toBe(false)
  })

  it('onMouseInput is always polling', () => {
    const b = board({ type: 'entity_class', className: 'Player' })
    const event = ev({
      type: 'onMouseInput',
      button: 'left',
      eventType: 'pressed',
    })
    expect(usesTickFallback(event, b)).toBe(true)
    expect(getTriggerExecutionMode(event.trigger)).toBe('polling')
  })
})
