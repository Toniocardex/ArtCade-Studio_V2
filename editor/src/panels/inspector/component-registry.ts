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
  DialogComponent,
  LinearMoverComponent,
  CameraTargetComponent,
  MagneticItemComponent,
  HordeMemberComponent,
  PlatformerControllerComponent,
  GaugeComponent,
  SensorComponent,
  SolidComponent,
  TextComponent,
  TopDownControllerComponent,
} from '../../types/components'
import {
  DEFAULT_TEXT_ANCHOR,
  TEXT_ANCHORS,
  TEXT_ANCHOR_LABELS,
} from '../../utils/text-anchor'

export type FieldKind = 'number' | 'text' | 'select' | 'checkbox' | 'variable'

export interface FieldDescriptor {
  key:   string
  label: string
  kind:  FieldKind
  min?:  number
  max?:  number
  step?: number
  options?: string[]
  /** Display labels for select options (same order as `options`). */
  optionLabels?: string[]
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
  surfaceKind: 'solid',
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
const TEXT: TextComponent = {
  text: 'New text',
  bindKey: '',
  bindScope: 'global',
  format: 'text',
  digits: 2,
  prefix: '',
  suffix: '',
  fontPath: '',
  size: 24,
  colorHex: '#ffffff',
  align: DEFAULT_TEXT_ANCHOR, // 'bottom-right' — text flows down-right from entity
  offsetX: 0,
  offsetY: 0,
  screenSpace: false,
}
const GAUGE: GaugeComponent = {
  bindKey: 'hp',
  bindScope: 'local',
  maxValue: 100,
  width: 64,
  height: 8,
  fillColorHex: '#3ad13a',
  bgColorHex: '#202020',
  direction: 'horizontal',
  offsetX: 0,
  offsetY: -40,
  screenSpace: false,
}
const DIALOG: DialogComponent = {
  dialogId: 'innkeeper',
  startNode: '',
  textSpeed: 40,
  triggerMessage: '',
}

export const COMPONENT_REGISTRY: ComponentDescriptor[] = [
  {
    key: 'sensor',
    label: 'Trigger Area',
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
    description:
      'Ground for Platformer Controller (Solid or One-Way). Solid blocks on all sides (native AABB); One-Way only lands on the top edge when falling. Does not require Physics. Match Ground Class on the player.',
    color: 'var(--yellow)',
    create: () => ({ ...SOLID }),
    fields: [
      {
        key: 'surfaceKind',
        label: 'Surface',
        kind: 'select',
        options: ['solid', 'oneWay'],
        optionLabels: ['Solid', 'One-Way'],
      },
      { key: 'groundClass', label: 'Ground Class', kind: 'text' },
    ],
  },
  {
    key: 'platformerController',
    label: 'Platformer Controller',
    description:
      'Arcade feel: Coyote Time and Jump Buffer. Movement is on the transform (no physics body by default). Add Physics for collision overlap, or use Solid platforms + Ground Class.',
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
    description:
      'Moves with acceleration and friction. Uses an automatic collider based on the object bounds, so objects with the Solid component block movement. Add Physics (Collider) only to customize the hitbox.',
    color: 'var(--accent)',
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
    color: 'var(--accent)',
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
    color: 'var(--accent)',
    create: () => ({ ...CAMERA_TARGET }),
    fields: [
      { key: 'offsetX', label: 'Offset X (px)', kind: 'number', step: 1 },
      { key: 'offsetY', label: 'Offset Y (px)', kind: 'number', step: 1 },
      { key: 'followSpeed', label: 'Follow speed (1/s)', kind: 'number', min: 0, step: 0.5 },
    ],
  },
  {
    key: 'magneticItem',
    label: 'Magnetic Attraction',
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
  {
    key: 'text',
    label: 'Text Label',
    description:
      'World-space text label (score, titles, hints). Update it from the Logic Board with Set Text — bind a variable to show live values.',
    color: 'var(--accent)',
    create: () => ({ ...TEXT }),
    fields: [
      { key: 'text', label: 'Text', kind: 'text' },
      {
        key: 'bindScope', label: 'Variable scope', kind: 'select',
        options: ['global', 'local'],
        optionLabels: ['Global — shared across all objects', 'Local — private to this object'],
      },
      { key: 'bindKey', label: 'Variable (empty = static text)', kind: 'variable' },
      {
        key: 'format', label: 'Format', kind: 'select',
        options: ['text', 'integer', 'padded', 'time', 'percent', 'decimals'],
        optionLabels: ['Text', 'Integer', 'Zero-padded', 'Time m:ss', 'Percent', 'Decimals'],
        visibleWhen: (c) => !!c.bindKey,
      },
      {
        key: 'digits', label: 'Digits', kind: 'number', min: 0, step: 1,
        visibleWhen: (c) => !!c.bindKey && (c.format === 'padded' || c.format === 'decimals'),
      },
      { key: 'prefix', label: 'Prefix', kind: 'text', visibleWhen: (c) => !!c.bindKey },
      { key: 'suffix', label: 'Suffix', kind: 'text', visibleWhen: (c) => !!c.bindKey },
      { key: 'fontPath', label: 'Font path (empty = default)', kind: 'text' },
      { key: 'size', label: 'Size (px)', kind: 'number', min: 4, step: 1 },
      { key: 'colorHex', label: 'Color (#rrggbb)', kind: 'text' },
      {
        key: 'align', label: 'Anchor', kind: 'select',
        options: [...TEXT_ANCHORS],
        optionLabels: [...TEXT_ANCHOR_LABELS],
      },
      { key: 'offsetX', label: 'Offset X (px)', kind: 'number', step: 1 },
      { key: 'offsetY', label: 'Offset Y (px)', kind: 'number', step: 1 },
      { key: 'screenSpace', label: 'Stay on screen (HUD)', kind: 'checkbox' },
    ],
  },
  {
    key: 'gauge',
    label: 'Gauge',
    description:
      'Filled bar driven by a variable — health, mana, progress. Set the variable and Max value; the fill tracks it automatically. Enable Stay on screen for a HUD bar.',
    color: 'var(--accent)',
    create: () => ({ ...GAUGE }),
    fields: [
      {
        key: 'bindScope', label: 'Variable scope', kind: 'select',
        options: ['global', 'local'],
        optionLabels: ['Global — shared across all objects', 'Local — private to this object'],
      },
      { key: 'bindKey', label: 'Variable', kind: 'variable' },
      { key: 'maxValue', label: 'Max value (full bar)', kind: 'number', min: 0, step: 1 },
      { key: 'width', label: 'Width (px)', kind: 'number', min: 1, step: 1 },
      { key: 'height', label: 'Height (px)', kind: 'number', min: 1, step: 1 },
      { key: 'fillColorHex', label: 'Fill color (#rrggbb)', kind: 'text' },
      { key: 'bgColorHex', label: 'Track color (#rrggbb)', kind: 'text' },
      {
        key: 'direction', label: 'Direction', kind: 'select',
        options: ['horizontal', 'vertical'],
        optionLabels: ['Horizontal', 'Vertical'],
      },
      { key: 'offsetX', label: 'Offset X (px)', kind: 'number', step: 1 },
      { key: 'offsetY', label: 'Offset Y (px)', kind: 'number', step: 1 },
      { key: 'screenSpace', label: 'Stay on screen (HUD)', kind: 'checkbox' },
    ],
  },
  {
    key: 'dialog',
    label: 'Dialog',
    description: 'Talkable NPC — edit lines with Edit dialog, then Start Dialog on the Logic Board or dialog.start in Lua.',
    color: 'var(--accent)',
    create: () => ({ ...DIALOG }),
    fields: [
      { key: 'dialogId', label: 'Dialog ID', kind: 'text' },
      { key: 'startNode', label: 'Start node override', kind: 'text' },
      { key: 'textSpeed', label: 'Text speed (chars/s)', kind: 'number', min: 1, step: 5 },
      { key: 'triggerMessage', label: 'Trigger message', kind: 'text' },
    ],
  },
]

export function descriptorFor(key: ComponentKey): ComponentDescriptor | undefined {
  return COMPONENT_REGISTRY.find((d) => d.key === key)
}
