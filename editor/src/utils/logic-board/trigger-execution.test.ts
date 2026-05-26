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
  it('classifies trigger picker groups', () => {
    expect(triggerPickerGroup('onUpdate')).toBe('Every frame')
    expect(triggerPickerGroup('onSpawn')).toBe('Object state')
    expect(triggerPickerGroup('onCollisionEnter')).toBe('Contact')
    expect(triggerPickerGroup('onTriggerEnter')).toBe('Zones')
    expect(triggerPickerGroup('onObjectClick')).toBe('Input')
    expect(triggerPickerGroup('onObjectHoverEnter')).toBe('Input')
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

  it('onSpawn uses event when board has entity_class target', () => {
    const b = board({ type: 'entity_class', className: 'Bullet' })
    const event = ev({ type: 'onSpawn' })
    expect(canRegisterLifecycleSpawn(event, b)).toBe(true)
    expect(usesTickFallback(event, b)).toBe(false)
  })

  it('onSpawn never tick-fallbacks even when no class resolves (N3 guard)', () => {
    // entity_id board without a project -> no resolvable className.
    // Previously this would route to tick fallback and the generic gate
    // path would fire actions every frame. After N3, usesTickFallback
    // returns false unconditionally for onSpawn; emitEventRegistration
    // returns null so the event is silently dropped instead.
    const b = board({ type: 'entity_id', entityId: 99 })
    const event = ev({ type: 'onSpawn' })
    expect(canRegisterLifecycleSpawn(event, b)).toBe(false)
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

  it('onObjectClick is checked continuously against the object hit area', () => {
    const b = board({ type: 'entity_class', className: 'Button' })
    const event = ev({
      type: 'onObjectClick',
      button: 'left',
      radius: 32,
    })
    expect(usesTickFallback(event, b)).toBe(true)
    expect(getTriggerExecutionMode(event.trigger)).toBe('polling')
  })

  it('object hover triggers are checked continuously against the object hit area', () => {
    const b = board({ type: 'entity_class', className: 'Button' })
    const enter = ev({ type: 'onObjectHoverEnter', radius: 32 })
    const exit = ev({ type: 'onObjectHoverExit', radius: 32 })
    expect(usesTickFallback(enter, b)).toBe(true)
    expect(usesTickFallback(exit, b)).toBe(true)
    expect(getTriggerExecutionMode(enter.trigger)).toBe('polling')
  })
})
