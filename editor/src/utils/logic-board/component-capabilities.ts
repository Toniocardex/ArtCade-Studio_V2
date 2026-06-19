import type { ProjectDoc } from '../../types'
import { COMPONENT_KEYS, type ComponentKey } from '../../types/components'
import type {
  LogicAction,
  LogicActionType,
  LogicBoard,
  LogicCondition,
  LogicTrigger,
  TargetSelector,
} from '../../types/logic-board'
import { logicBoardTargetEntityIds } from '../project-queries'
import { collisionTriggerRequirement } from './physics-trigger-capabilities'

export type CapabilityStatus = 'present' | 'partial' | 'missing' | 'unknown'

export interface CapabilityRequirement {
  /** Runtime Component when quick-add is possible. */
  component?: ComponentKey
  label: string
  status: CapabilityStatus
  message: string
}

type CapabilityKind = 'action' | 'condition' | 'trigger'
type CapabilityFeature = ComponentKey | 'physics' | 'animation'
type CapabilityOwner = Partial<Record<CapabilityFeature, unknown>>

interface CapabilityDef {
  kind: CapabilityKind
  type: string
  feature: CapabilityFeature
  label: string
}

const CAPABILITIES: CapabilityDef[] = [
  { kind: 'action', type: 'controllerMovement', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'moveController', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'clearMovementIntent', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'controllerMovement', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'moveController', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'clearMovementIntent', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'requestPlatformerJump', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'setPlatformerMaxSpeed', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'setPlatformerJumpForce', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'setPlatformerGravity', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'setTopDownMaxSpeed', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'setTopDownAcceleration', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'setTopDownFriction', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'action', type: 'setTopDownFourDirections', feature: 'topDownController', label: 'Top-Down Controller' },
  { kind: 'condition', type: 'isPlatformerGrounded', feature: 'platformerController', label: 'Platformer Controller' },
  { kind: 'action', type: 'damageEntity', feature: 'health', label: 'Health' },
  { kind: 'action', type: 'healEntity', feature: 'health', label: 'Health' },
  { kind: 'action', type: 'setEntityHealth', feature: 'health', label: 'Health' },
  { kind: 'condition', type: 'compareHealth', feature: 'health', label: 'Health' },
  { kind: 'trigger', type: 'onHealthDepleted', feature: 'health', label: 'Health' },
  { kind: 'trigger', type: 'onDamaged', feature: 'health', label: 'Health' },
  { kind: 'action', type: 'setLinearMoverDirection', feature: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'setLinearMoverSpeed', feature: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'pauseLinearMover', feature: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'resumeLinearMover', feature: 'linearMover', label: 'Linear Mover' },
  { kind: 'action', type: 'setMagnetEnabled', feature: 'magneticItem', label: 'Magnetic Attraction' },
  { kind: 'action', type: 'setMagnetTargetTag', feature: 'magneticItem', label: 'Magnetic Attraction' },
  { kind: 'action', type: 'setMagnetRadius', feature: 'magneticItem', label: 'Magnetic Attraction' },
  { kind: 'action', type: 'setMagnetPullSpeed', feature: 'magneticItem', label: 'Magnetic Attraction' },
  { kind: 'action', type: 'setHordeTargetClass', feature: 'hordeMember', label: 'Horde Member' },
  { kind: 'action', type: 'setHordeWeights', feature: 'hordeMember', label: 'Horde Member' },
  { kind: 'action', type: 'setHordeMaxSpeed', feature: 'hordeMember', label: 'Horde Member' },
  { kind: 'action', type: 'setHordeSeparationRadius', feature: 'hordeMember', label: 'Horde Member' },
  { kind: 'action', type: 'setText', feature: 'text', label: 'Text Label' },
  { kind: 'action', type: 'setTextColor', feature: 'text', label: 'Text Label' },
  { kind: 'action', type: 'setAutoDestroyLifespan', feature: 'autoDestroy', label: 'Auto Destroy' },
  { kind: 'action', type: 'cancelAutoDestroy', feature: 'autoDestroy', label: 'Auto Destroy' },
  { kind: 'action', type: 'applyImpulse', feature: 'physics', label: 'Physics' },
  { kind: 'action', type: 'applyForce', feature: 'physics', label: 'Physics' },
  { kind: 'action', type: 'playAnimation', feature: 'animation', label: 'Animation' },
  { kind: 'trigger', type: 'onAnimationEnd', feature: 'animation', label: 'Animation' },
  { kind: 'trigger', type: 'onTriggerEnter', feature: 'sensor', label: 'Sensor' },
  { kind: 'trigger', type: 'onTriggerExit', feature: 'sensor', label: 'Sensor' },
]

const ACTION_RECOMMENDATIONS: Record<ComponentKey, LogicActionType[]> = {
  topDownController: ['controllerMovement', 'moveController', 'setTopDownMaxSpeed'],
  platformerController: ['controllerMovement', 'moveController', 'requestPlatformerJump', 'setPlatformerMaxSpeed', 'setPlatformerJumpForce'],
  health: ['damageEntity', 'healEntity', 'setEntityHealth'],
  sensor: [],
  solid: [],
  ladder: [],
  linearMover: ['setLinearMoverDirection', 'setLinearMoverSpeed', 'pauseLinearMover', 'resumeLinearMover'],
  cameraTarget: ['followCamera', 'useDefaultCameraTarget'],
  magneticItem: ['setMagnetEnabled', 'setMagnetTargetTag', 'setMagnetRadius', 'setMagnetPullSpeed'],
  hordeMember: ['setHordeTargetClass', 'setHordeWeights', 'setHordeMaxSpeed', 'setHordeSeparationRadius'],
  autoDestroy: ['setAutoDestroyLifespan', 'cancelAutoDestroy'],
  dialog: ['startDialog'],
  text: ['setText', 'setTextColor'],
  gauge: [],
}

const MOVEMENT_AUTHORITIES: Array<{ key: ComponentKey; label: string }> = [
  { key: 'platformerController', label: 'Platformer Controller' },
  { key: 'topDownController', label: 'Top-Down Controller' },
  { key: 'linearMover', label: 'Linear Mover' },
  { key: 'hordeMember', label: 'Horde Member' },
]

function defFor(kind: CapabilityKind, type: string): CapabilityDef[] {
  return CAPABILITIES.filter((capability) => capability.kind === kind && capability.type === type)
}

function ownersForSelector(
  project: ProjectDoc,
  board: LogicBoard,
  target?: TargetSelector,
): CapabilityOwner[] | null {
  if (target == null || target === 'self') {
    const typeId = board.target.type === 'object_type' ? board.target.objectTypeId : undefined
    const objectType = typeId ? project.objectTypes?.[typeId] : undefined
    if (objectType) return [objectType]
    return logicBoardTargetEntityIds(project, board)
      .map((id) => project.entities[id])
      .filter((entity): entity is NonNullable<typeof entity> => entity != null)
  }
  if (target === 'other') return null
  if ('entityId' in target) {
    const entity = project.entities[target.entityId]
    return entity ? [entity] : []
  }
  const objectType = project.objectTypes?.[target.className]
  if (objectType) return [objectType]
  return Object.values(project.entities).filter((entity) => entity.className === target.className)
}

function statusFor(
  owners: CapabilityOwner[] | null,
  feature: CapabilityFeature,
): CapabilityStatus {
  if (owners == null) return 'unknown'
  if (owners.length === 0) return 'missing'
  const count = owners.filter((owner) => owner[feature] != null).length
  if (count === owners.length) return 'present'
  if (count > 0) return 'partial'
  return 'missing'
}

function messageFor(label: string, status: CapabilityStatus): string {
  if (status === 'partial') {
    return `Some targets do not have ${label}; this block will only work on compatible objects.`
  }
  if (status === 'missing') {
    return `This block expects ${label}; add it in the Inspector or choose a compatible target.`
  }
  return ''
}

function componentForFeature(feature: CapabilityFeature): ComponentKey | undefined {
  return COMPONENT_KEYS.includes(feature as ComponentKey) ? feature as ComponentKey : undefined
}

function requirement(
  project: ProjectDoc | null | undefined,
  board: LogicBoard | null | undefined,
  def: CapabilityDef,
  target?: TargetSelector,
): CapabilityRequirement | null {
  if (!project || !board) return null
  const status = statusFor(ownersForSelector(project, board, target), def.feature)
  if (status === 'present' || status === 'unknown') return null
  return {
    component: componentForFeature(def.feature),
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
  const owners = ownersForSelector(project, board)
  const out = new Set<LogicActionType>()
  for (const key of COMPONENT_KEYS) {
    const status = statusFor(owners, key)
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
  if (defs.length === 0 || !project || !board) return null
  const target = 'target' in action ? action.target : undefined
  const owners = ownersForSelector(project, board, target)
  const requirements: CapabilityRequirement[] = []
  for (const def of defs) {
    const status = statusFor(owners, def.feature)
    if (status === 'present' || status === 'unknown') return null
    requirements.push({
      component: componentForFeature(def.feature),
      label: def.label,
      status,
      message: messageFor(def.label, status),
    })
  }
  return requirements.find((item) => item.status === 'partial') ?? requirements[0] ?? null
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
  const collision = collisionTriggerRequirement(trigger, project, board)
  if (collision) return collision
  const def = defFor('trigger', trigger.type)[0]
  return def ? requirement(project, board, def) : null
}

/** Warn when an Object Type has multiple systems writing its movement. */
export function boardComponentWarnings(project: ProjectDoc, board: LogicBoard): string[] {
  if (board.target.type !== 'object_type' || !board.target.objectTypeId) return []
  const objectType = project.objectTypes?.[board.target.objectTypeId]
  if (!objectType) return []
  const warnings: string[] = []
  const active = MOVEMENT_AUTHORITIES.filter(({ key }) => objectType[key] != null)
  if (active.length >= 2) {
    warnings.push(
      `${objectType.displayName || objectType.id} has multiple movement Components: ${active.map(({ label }) => label).join(', ')}. Keep one movement authority to avoid conflicting velocity or position writes.`,
    )
  }

  if (objectType.cameraTarget) {
    const scene = project.scenes?.[project.activeSceneId]
    const cameraTargetIds = new Set<number>()
    for (const id of scene?.entityIds ?? []) {
      const entity = project.entities[id]
      const type = entity ? project.objectTypes?.[entity.className] : undefined
      if (entity?.cameraTarget || type?.cameraTarget) cameraTargetIds.add(id)
    }
    for (const instance of scene?.instances ?? []) {
      if (project.objectTypes?.[instance.objectTypeId]?.cameraTarget)
        cameraTargetIds.add(instance.id)
    }
    if (cameraTargetIds.size > 1) {
      warnings.push(
        `The active scene has ${cameraTargetIds.size} Camera Target instances. Runtime follow is deterministic and uses the lowest active entity ID; use Follow Object with Camera to choose explicitly.`,
      )
    }
  }

  return warnings
}
