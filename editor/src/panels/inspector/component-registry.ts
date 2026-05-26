// ---------------------------------------------------------------------------
// Component registry — data-driven descriptors for the Inspector.
//
// The component DATA is strongly typed (types/components.ts). This registry is
// the UI-side description: which fields to render, their kind/range, and
// optional conditional visibility (e.g. Sensor.radius only when shape=Circle).
// Adding a component to the Inspector = adding a descriptor here, no JSX edits.
// ---------------------------------------------------------------------------

import type {
  AutoDestroyComponent,
  ComponentKey,
  HealthComponent,
  LinearMoverComponent,
  CameraTargetComponent,
  MagneticItemComponent,
  HordeMemberComponent,
  PlatformerControllerComponent,
  SensorComponent,
  SolidComponent,
  TopDownControllerComponent,
} from '../../types/components'

export type FieldKind = 'number' | 'text' | 'select' | 'checkbox'

export interface FieldDescriptor {
  key:   string
  label: string
  kind:  FieldKind
  min?:  number
  max?:  number
  step?: number
  options?: string[]
  /** Field shown only when this predicate holds (conditional fields). */
  visibleWhen?: (c: Record<string, unknown>) => boolean
}

export interface ComponentDescriptor {
  /** EntityDef field name this component is stored under. */
  key:     ComponentKey
  label:   string
  /** Optional helper shown under the component title in the Inspector. */
  description?: string
  /** Accent colour (matches the arcade palette). */
  color:   string
  /** Factory for a sane default instance when the user adds the component. */
  create:  () => Record<string, unknown>
  fields:  FieldDescriptor[]
}

const SENSOR: SensorComponent = {
  shape: 'Circle', radius: 120, width: 64, height: 64, targetTag: 'player',
}
const SOLID: SolidComponent = {
  groundClass: 'Ground',
}
const PLATFORMER: PlatformerControllerComponent = {
  maxSpeed: 300, jumpForce: 600, customGravity: 1500,
  coyoteTime: 0.15, jumpBuffer: 0.1, groundClass: 'Ground',
}
const TOP_DOWN: TopDownControllerComponent = {
  maxSpeed: 260, acceleration: 1600, friction: 2200, fourDirections: false,
}
const LINEAR_MOVER: LinearMoverComponent = {
  directionX: 1, directionY: 0, speed: 300,
}
const CAMERA_TARGET: CameraTargetComponent = {
  offsetX: 0, offsetY: 0, followSpeed: 8,
}
const MAGNETIC_ITEM: MagneticItemComponent = {
  attractTag: 'pickup', radius: 200, pullSpeed: 400,
}
const HORDE_MEMBER: HordeMemberComponent = {
  targetClass: 'Player', maxSpeed: 120,
  separationRadius: 48, separationWeight: 1.5, chaseWeight: 1,
}
const HEALTH: HealthComponent = { maxHp: 100, currentHp: 100, iFrames: 0.2 }
const AUTODESTROY: AutoDestroyComponent = { lifespan: 0 }

export const COMPONENT_REGISTRY: ComponentDescriptor[] = [
  {
    key: 'sensor',
    label: 'Sensor (Box2D Trigger)',
    color: 'var(--accent)',
    create: () => ({ ...SENSOR }),
    fields: [
      { key: 'shape', label: 'Shape', kind: 'select', options: ['Circle', 'Rectangle'] },
      {
        key: 'radius', label: 'Radius (px)', kind: 'number', min: 1, step: 1,
        visibleWhen: (c) => c.shape === 'Circle',
      },
      {
        key: 'width', label: 'Width (px)', kind: 'number', min: 1, step: 1,
        visibleWhen: (c) => c.shape === 'Rectangle',
      },
      {
        key: 'height', label: 'Height (px)', kind: 'number', min: 1, step: 1,
        visibleWhen: (c) => c.shape === 'Rectangle',
      },
      { key: 'targetTag', label: 'Target Tag', kind: 'text' },
    ],
  },
  {
    key: 'solid',
    label: 'Solid',
    color: 'var(--yellow)',
    create: () => ({ ...SOLID }),
    fields: [
      { key: 'groundClass', label: 'Ground Class', kind: 'text' },
    ],
  },
  {
    key: 'platformerController',
    label: 'Platformer Controller',
    description:
      'Arcade feel: Coyote Time and Jump Buffer. Movement is on the transform (no Box2D body by default). Add Physics for collision overlap, or use Solid platforms + Ground Class.',
    color: 'var(--yellow)',
    create: () => ({ ...PLATFORMER }),
    fields: [
      { key: 'maxSpeed', label: 'Max Speed (px/s)', kind: 'number', min: 0, step: 10 },
      { key: 'jumpForce', label: 'Jump Force', kind: 'number', min: 0, step: 10 },
      { key: 'customGravity', label: 'Custom Gravity', kind: 'number', min: 0, step: 50 },
      { key: 'coyoteTime', label: 'Coyote Time (s)', kind: 'number', min: 0, step: 0.05 },
      { key: 'jumpBuffer', label: 'Jump Buffer (s)', kind: 'number', min: 0, step: 0.05 },
      { key: 'groundClass', label: 'Ground Class', kind: 'text' },
    ],
  },
  {
    key: 'topDownController',
    label: 'Top-Down Controller',
    color: 'var(--accent-2)',
    create: () => ({ ...TOP_DOWN }),
    fields: [
      { key: 'maxSpeed', label: 'Max Speed (px/s)', kind: 'number', min: 0, step: 10 },
      { key: 'acceleration', label: 'Acceleration (px/s^2)', kind: 'number', min: 0, step: 50 },
      { key: 'friction', label: 'Friction (px/s^2)', kind: 'number', min: 0, step: 50 },
      { key: 'fourDirections', label: 'Limit to 4 directions', kind: 'checkbox' },
    ],
  },
  {
    key: 'linearMover',
    label: 'Linear Mover',
    color: 'var(--blue)',
    create: () => ({ ...LINEAR_MOVER }),
    fields: [
      { key: 'directionX', label: 'Direction X', kind: 'number', step: 0.1 },
      { key: 'directionY', label: 'Direction Y', kind: 'number', step: 0.1 },
      { key: 'speed', label: 'Speed (px/s)', kind: 'number', min: 0, step: 10 },
    ],
  },
  {
    key: 'cameraTarget',
    label: 'Camera Target',
    color: 'var(--purple)',
    create: () => ({ ...CAMERA_TARGET }),
    fields: [
      { key: 'offsetX', label: 'Offset X (px)', kind: 'number', step: 1 },
      { key: 'offsetY', label: 'Offset Y (px)', kind: 'number', step: 1 },
      { key: 'followSpeed', label: 'Follow speed (1/s)', kind: 'number', min: 0, step: 0.5 },
    ],
  },
  {
    key: 'magneticItem',
    label: 'Magnetic Item',
    color: 'var(--accent)',
    create: () => ({ ...MAGNETIC_ITEM }),
    fields: [
      { key: 'attractTag', label: 'Attract tag', kind: 'text' },
      { key: 'radius', label: 'Radius (px, 0=any)', kind: 'number', min: 0, step: 10 },
      { key: 'pullSpeed', label: 'Pull speed (px/s)', kind: 'number', min: 0, step: 10 },
    ],
  },
  {
    key: 'hordeMember',
    label: 'Horde Member',
    color: 'var(--warn)',
    create: () => ({ ...HORDE_MEMBER }),
    fields: [
      { key: 'targetClass', label: 'Chase class', kind: 'text' },
      { key: 'maxSpeed', label: 'Max speed (px/s)', kind: 'number', min: 0, step: 10 },
      { key: 'separationRadius', label: 'Separation radius (px)', kind: 'number', min: 0, step: 4 },
      { key: 'separationWeight', label: 'Separation weight', kind: 'number', min: 0, step: 0.1 },
      { key: 'chaseWeight', label: 'Chase weight', kind: 'number', min: 0, step: 0.1 },
    ],
  },
  {
    key: 'health',
    label: 'Health',
    color: 'var(--danger)',
    create: () => ({ ...HEALTH }),
    fields: [
      { key: 'maxHp', label: 'Max HP', kind: 'number', min: 1, step: 1 },
      { key: 'currentHp', label: 'Current HP', kind: 'number', min: 0, step: 1 },
      { key: 'iFrames', label: 'I-Frames (s)', kind: 'number', min: 0, step: 0.05 },
    ],
  },
  {
    key: 'autoDestroy',
    label: 'Auto Destroy',
    color: 'var(--warn)',
    create: () => ({ ...AUTODESTROY }),
    fields: [
      { key: 'lifespan', label: 'Lifespan (s, 0=manual)', kind: 'number', min: 0, step: 0.1 },
    ],
  },
]

export function descriptorFor(key: ComponentKey): ComponentDescriptor | undefined {
  return COMPONENT_REGISTRY.find((d) => d.key === key)
}
