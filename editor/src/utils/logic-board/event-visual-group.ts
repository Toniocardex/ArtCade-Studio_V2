import type { LogicEvent } from '../../types/logic-board'
import { triggerPickerGroup } from './trigger-execution'
import type { LogicTriggerType } from '../../types/logic-board'

/** Visual-only sidebar groups (not persisted on LogicEvent). */
export type EventVisualGroup =
  | 'Input'
  | 'Movement'
  | 'Combat'
  | 'Lifecycle'
  | 'Time'
  | 'Other'

const GROUP_ORDER: readonly EventVisualGroup[] = [
  'Input',
  'Movement',
  'Combat',
  'Lifecycle',
  'Time',
  'Other',
]

export function eventVisualGroup(event: LogicEvent): EventVisualGroup {
  const t = event.trigger.type
  if (t === 'onInput' || t === 'onMouseInput') return 'Input'
  if (t === 'onObjectClick' || t === 'onObjectHoverEnter' || t === 'onObjectHoverExit') {
    return 'Input'
  }
  if (
    t === 'onCollision' ||
    t === 'onCollisionEnter' ||
    t === 'onCollisionExit' ||
    t === 'onTriggerEnter' ||
    t === 'onTriggerExit'
  ) {
    return 'Combat'
  }
  if (t === 'onSpawn' || t === 'onDestroy' || t === 'onAnimationEnd') return 'Lifecycle'
  if (t === 'onStart' || t === 'onTimer' || t === 'onUpdate') return 'Time'
  if (event.actions.some((a) => a.type === 'controllerMovement')) return 'Movement'
  if (triggerPickerGroup(t as LogicTriggerType) === 'Input') return 'Input'
  return 'Other'
}

export function groupEventsByVisualCategory(
  events: readonly LogicEvent[],
): ReadonlyMap<EventVisualGroup, LogicEvent[]> {
  const map = new Map<EventVisualGroup, LogicEvent[]>()
  for (const ev of events) {
    const g = eventVisualGroup(ev)
    const list = map.get(g) ?? []
    list.push(ev)
    map.set(g, list)
  }
  return map
}

export function orderedVisualGroups(
  map: ReadonlyMap<EventVisualGroup, LogicEvent[]>,
): ReadonlyArray<{ group: EventVisualGroup; events: LogicEvent[] }> {
  return GROUP_ORDER.filter((g) => (map.get(g)?.length ?? 0) > 0).map((group) => ({
    group,
    events: map.get(group) ?? [],
  }))
}
