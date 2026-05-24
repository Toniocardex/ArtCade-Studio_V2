import type { ProjectDoc } from '../../types'
import type { ComponentKey } from '../../types/components'
import type {
  LogicAction,
  LogicActionType,
  LogicBoard,
  LogicCondition,
  LogicTrigger,
  TargetSelector,
} from '../../types/logic-board'

export type CapabilityStatus = 'present' | 'partial' | 'missing' | 'unknown'

export interface CapabilityRequirement {
  component: ComponentKey
  label: string
  status: CapabilityStatus
  message: string
}

type CapabilityKind = 'action' | 'condition' | 'trigger'

interface CapabilityDef {
  kind: CapabilityKind
  type: string
  component: ComponentKey
  label: string
}

const CAPABILITIES: CapabilityDef[] = [
  { kind: 'action', type: 'controllerMovement', component: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'setMovementIntent', component: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'moveController', component: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'clearMovementIntent', component: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'controllerMovement', component: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'setMovementIntent', component: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'moveController', component: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'clearMovementIntent', component: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'requestPlatformerJump', component: 'platformerController', label: 'Platformer Controller' },
  { kind: 'condition', type: 'isPlatformerGrounded', component: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'damageEntity', component: 'health', label: 'Health' },
  { kind: 'action', type: 'healEntity', component: 'health', label: 'Health' },
  { kind: 'action', type: 'setEntityHealth', component: 'health', label: 'Health' },
  { kind: 'condition', type: 'compareHealth', component: 'health', label: 'Health' },
  { kind: 'action', type: 'setLinearMoverDirection', component: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'setLinearMoverSpeed', component: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'pauseLinearMover', component: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'resumeLinearMover', component: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'setMagnetEnabled', component: 'magneticItem', label: 'Magnetic Item' },
  { kind: 'action', type: 'setMagnetTargetTag', component: 'magneticItem', label: 'Magnetic Item' },
  { kind: 'action', type: 'setHordeTargetClass', component: 'hordeMember', label: 'Horde Member' },
  { kind: 'action', type: 'setHordeWeights', component: 'hordeMember', label: 'Horde Member' },
  { kind: 'action', type: 'setAutoDestroyLifespan', component: 'autoDestroy', label: 'Auto Destroy' },
  { kind: 'action', type: 'cancelAutoDestroy', component: 'autoDestroy', label: 'Auto Destroy' },
  { kind: 'trigger', type: 'onTriggerEnter', component: 'sensor', label: 'Sensor' },
  { kind: 'trigger', type: 'onTriggerExit', component: 'sensor', label: 'Sensor' },
]

const ACTION_RECOMMENDATIONS: Record<ComponentKey, LogicActionType[]> = {
  topDownController: ['controllerMovement', 'moveController', 'setMovementIntent', 'clearMovementIntent'],
  platformerController: ['controllerMovement', 'moveController', 'setMovementIntent', 'clearMovementIntent', 'requestPlatformerJump'],
  health: ['damageEntity', 'healEntity', 'setEntityHealth'],
  sensor: [],
  solid: [],
  linearMover: ['setLinearMoverDirection', 'setLinearMoverSpeed', 'pauseLinearMover', 'resumeLinearMover'],
  cameraTarget: ['setCameraTarget'],
  magneticItem: ['setMagnetEnabled', 'setMagnetTargetTag'],
  hordeMember: ['setHordeTargetClass', 'setHordeWeights'],
  autoDestroy: ['setAutoDestroyLifespan', 'cancelAutoDestroy'],
}

function defFor(kind: CapabilityKind, type: string): CapabilityDef[] {
  return CAPABILITIES.filter((c) => c.kind === kind && c.type === type)
}

function targetEntities(project: ProjectDoc, board: LogicBoard): number[] {
  if (board.target.type === 'entity_id' && board.target.entityId != null) {
    return project.entities[board.target.entityId] ? [board.target.entityId] : []
  }
  if (board.target.type === 'entity_class' && board.target.className) {
    return Object.values(project.entities)
      .filter((entity) => entity.className === board.target.className)
      .map((entity) => entity.id)
  }
  return []
}

function entitiesForSelector(
  project: ProjectDoc,
  board: LogicBoard,
  target?: TargetSelector,
): number[] | null {
  if (target == null || target === 'self') return targetEntities(project, board)
  if (target === 'other') return null
  if ('entityId' in target) return project.entities[target.entityId] ? [target.entityId] : []
  if ('className' in target) {
    return Object.values(project.entities)
      .filter((entity) => entity.className === target.className)
      .map((entity) => entity.id)
  }
  return null
}

function statusFor(
  project: ProjectDoc,
  entityIds: number[] | null,
  component: ComponentKey,
): CapabilityStatus {
  if (entityIds == null) return 'unknown'
  if (entityIds.length === 0) return 'missing'
  const count = entityIds.filter((id) => project.entities[id]?.[component] != null).length
  if (count === entityIds.length) return 'present'
  if (count > 0) return 'partial'
  return 'missing'
}

function messageFor(label: string, status: CapabilityStatus): string {
  if (status === 'partial') {
    return `Some targets do not have ${label}; this block will only work on entities with that Component.`
  }
  if (status === 'missing') {
    return `This block expects ${label}; add that Component in the Inspector or choose a compatible target.`
  }
  return ''
}

function requirement(
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
  def: CapabilityDef,
  target?: TargetSelector,
): CapabilityRequirement | null {
  if (!project || !board) return null
  const status = statusFor(project, entitiesForSelector(project, board, target), def.component)
  if (status === 'present' || status === 'unknown') return null
  return {
    component: def.component,
    label: def.label,
    status,
    message: messageFor(def.label, status),
  }
}

export function recommendedActionTypes(
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): LogicActionType[] {
  if (!project || !board) return []
  const ids = targetEntities(project, board)
  const out = new Set<LogicActionType>()
  for (const key of Object.keys(ACTION_RECOMMENDATIONS) as ComponentKey[]) {
    const status = statusFor(project, ids, key)
    if (status === 'present' || status === 'partial') {
      for (const actionType of ACTION_RECOMMENDATIONS[key]) out.add(actionType)
    }
  }
  return [...out]
}

export function actionRequirement(
  action: LogicAction,
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): CapabilityRequirement | null {
  const defs = defFor('action', action.type)
  if (defs.length === 0) return null
  const target = 'target' in action ? action.target : undefined
  if (!project || !board) return null
  const entityIds = entitiesForSelector(project, board, target)
  const requirements: CapabilityRequirement[] = []
  for (const def of defs) {
    const status = statusFor(project, entityIds, def.component)
    if (status === 'present' || status === 'unknown') return null
    requirements.push({
      component: def.component,
      label: def.label,
      status,
      message: messageFor(def.label, status),
    })
  }
  return requirements.find((r) => r.status === 'partial') ?? requirements[0] ?? null
}

export function conditionRequirement(
  condition: LogicCondition,
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): CapabilityRequirement | null {
  const def = defFor('condition', condition.type)[0]
  if (!def) return null
  const target = 'target' in condition ? condition.target : undefined
  return requirement(project, board, def, target)
}

export function triggerRequirement(
  trigger: LogicTrigger,
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
): CapabilityRequirement | null {
  const def = defFor('trigger', trigger.type)[0]
  if (!def) return null
  return requirement(project, board, def)
}
