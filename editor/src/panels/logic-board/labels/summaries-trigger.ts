import type { ProjectDoc } from '../../../types'
import type { LogicTrigger } from '../../../types/logic-board'
import { formatKeyLabel } from '../../../components/logic-board/KeyCapture'
import { fmtClass } from './board-labels'

export function triggerSummaryPlain(
  t: LogicTrigger,
  project?: ProjectDoc | null,
): string {
  switch (t.type) {
    case 'onStart':
      return 'When the game starts'
    case 'onSpawn':
      return 'When this object spawns'
    case 'onUpdate':
      return 'Every frame while playing'
    case 'onCollision':
      return t.withClass
        ? `When touching "${fmtClass(t.withClass, project)}"`
        : 'When touching something'
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
      const key = formatKeyLabel(t.keyCode)
      const when =
        t.eventType === 'pressed'
          ? 'presses'
          : t.eventType === 'released'
            ? 'releases'
            : 'holds'
      return `When player ${when} ${key}`
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
    case 'onMessage':
      return `When message "${t.messageName || '...'}" is received`
    case 'onTimer':
      return t.repeat
        ? `Every ${t.seconds} seconds (repeating)`
        : `After ${t.seconds} seconds`
  }
}
