import type { ProjectDoc } from '../../../types'
import type { LogicEvent, LogicTrigger } from '../../../types/logic-board'
import {
  clickToDestroySummary,
  isClickToDestroyEvent,
} from '../../../utils/logic-board/click-to-destroy'
import { formatKeyLabel } from '../../../components/logic-board/KeyCapture'
import {
  getKeyCombine,
  getOnInputKeyCodes,
} from '../../../utils/logic-board/on-input-keys'
import { fmtClass } from './board-labels'

export function eventTriggerSummaryPlain(
  event: LogicEvent,
  project?: ProjectDoc | null,
): string {
  if (isClickToDestroyEvent(event)) return clickToDestroySummary(event)
  return triggerSummaryPlain(event.trigger, project)
}

export function triggerSummaryPlain(
  t: LogicTrigger,
  project?: ProjectDoc | null,
): string {
  switch (t.type) {
    case 'onStart':
      return 'When the game starts'
    case 'onSpawn':
      return 'When this object is created'
    case 'onUpdate':
      return 'Every frame while playing'
    case 'onCollision':
      return t.withClass
        ? `While touching "${fmtClass(t.withClass, project)}"`
        : 'While touching something'
    case 'onCollisionEnter':
      return `When starting to touch "${fmtClass(t.withClass, project)}"`
    case 'onCollisionExit':
      return `When stopping touching "${fmtClass(t.withClass, project)}"`
    case 'onTriggerEnter':
      return t.withClass
        ? `When entering zone "${fmtClass(t.withClass, project)}"`
        : 'When entering a zone'
    case 'onTriggerExit':
      return t.withClass
        ? `When leaving zone "${fmtClass(t.withClass, project)}"`
        : 'When leaving a zone'
    case 'onAnimationEnd':
      return t.clipName
        ? `When animation "${t.clipName}" ends`
        : 'When an animation ends'
    case 'onDestroy':
      return 'When this object is destroyed'
    case 'onInput': {
      const keys = getOnInputKeyCodes(t).map((c) => formatKeyLabel(c))
      const combine = getKeyCombine(t)
      const join =
        combine === 'AND' ? ' and ' : combine === 'NOT' ? ' not ' : ' or '
      const keyLabel =
        combine === 'NOT' && keys.length > 1
          ? `not (${keys.join(' or ')})`
          : combine === 'NOT'
            ? `not ${keys[0]}`
            : keys.length > 1
              ? keys.join(join)
              : keys[0]
      const when =
        t.eventType === 'pressed'
          ? 'presses'
          : t.eventType === 'released'
            ? 'releases'
            : 'holds'
      return `When player ${when} ${keyLabel}`
    }
    case 'onMouseInput': {
      const btn = t.button === 'right' ? 'right' : 'left'
      const when =
        t.eventType === 'pressed'
          ? 'clicks'
          : t.eventType === 'released'
            ? 'releases'
            : 'holds'
      return `When ${btn} mouse button ${when}`
    }
    case 'onObjectClick': {
      const btn = t.button === 'right' ? 'right' : 'left'
      return `When this object is clicked with ${btn} mouse`
    }
    case 'onObjectHoverEnter':
      return 'When the pointer enters this object'
    case 'onObjectHoverExit':
      return 'When the pointer leaves this object'
    case 'onMessage':
      return `When message "${t.messageName || '...'}" is received`
    case 'onTimer':
      return t.repeat
        ? `Every ${t.seconds} seconds (repeating)`
        : `After ${t.seconds} seconds`
    case 'onHealthDepleted':
      return 'When this object\'s health reaches zero'
    case 'onDamaged':
      return 'When this object takes damage'
  }
}
