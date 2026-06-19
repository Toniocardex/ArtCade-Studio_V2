import { describe, expect, it } from 'vitest'
import type { LogicBoard, LogicEvent } from '../../types/logic-board'
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
    expect(triggerPickerGroup('onAnimationEnd')).toBe('Animation')
    expect(triggerPickerGroup('onAnimationStart')).toBe('Animation')
    expect(triggerPickerGroup('onAnimationFrame')).toBe('Animation')
    expect(triggerPickerGroup('onAnimationLoop')).toBe('Animation')
    expect(triggerPickerGroup('onAnimationChange')).toBe('Animation')
  })

  it('onInput pressed is event, down is polling', () => {
    const b = board({ type: 'object_type', objectTypeId: 'Player' })
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

  it('onInput NOT uses polling for all event types', () => {
    const notHeld = ev({
      type: 'onInput',
      keyCode: 'ShiftLeft',
      keyCombine: 'NOT',
      eventType: 'pressed',
    })
    expect(usesTickFallback(notHeld, board({ type: 'object_type', objectTypeId: 'P' }))).toBe(
      true,
    )
    expect(getTriggerExecutionMode(notHeld.trigger)).toBe('polling')
  })

  it('onDestroy uses event when board targets a type', () => {
    const b = board({ type: 'object_type', objectTypeId: 'Enemy' })
    const event = ev({ type: 'onDestroy' })
    expect(canRegisterLifecycleDestroy(event, b)).toBe(true)
    expect(usesTickFallback(event, b)).toBe(false)
  })

  it('onSpawn uses event when board has object_type target', () => {
    const b = board({ type: 'object_type', objectTypeId: 'Bullet' })
    const event = ev({ type: 'onSpawn' })
    expect(canRegisterLifecycleSpawn(event, b)).toBe(true)
    expect(usesTickFallback(event, b)).toBe(false)
  })

  it('onSpawn never tick-fallbacks even when no class resolves (N3 guard)', () => {
    // Global boards have no resolvable class; emitEventRegistration returns
    // null so the event is silently dropped instead of polling every frame.
    const b = board({ type: 'global' })
    const event = ev({ type: 'onSpawn' })
    expect(canRegisterLifecycleSpawn(event, b)).toBe(false)
    expect(usesTickFallback(event, b)).toBe(false)
  })

  it('onMouseInput is always polling', () => {
    const b = board({ type: 'object_type', objectTypeId: 'Player' })
    const event = ev({
      type: 'onMouseInput',
      button: 'left',
      eventType: 'pressed',
    })
    expect(usesTickFallback(event, b)).toBe(true)
    expect(getTriggerExecutionMode(event.trigger)).toBe('polling')
  })

  it('onObjectClick is checked continuously against the object hit area', () => {
    const b = board({ type: 'object_type', objectTypeId: 'Button' })
    const event = ev({
      type: 'onObjectClick',
      button: 'left',
      radius: 32,
    })
    expect(usesTickFallback(event, b)).toBe(true)
    expect(getTriggerExecutionMode(event.trigger)).toBe('polling')
  })

  it('object hover triggers are checked continuously against the object hit area', () => {
    const b = board({ type: 'object_type', objectTypeId: 'Button' })
    const enter = ev({ type: 'onObjectHoverEnter', radius: 32 })
    const exit = ev({ type: 'onObjectHoverExit', radius: 32 })
    expect(usesTickFallback(enter, b)).toBe(true)
    expect(usesTickFallback(exit, b)).toBe(true)
    expect(getTriggerExecutionMode(enter.trigger)).toBe('polling')
  })
})
