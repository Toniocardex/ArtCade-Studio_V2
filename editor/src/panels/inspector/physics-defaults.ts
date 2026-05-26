import type { PhysicsComponent } from '../../types'

export const DEFAULT_PHYSICS: PhysicsComponent = {
  bodyType: 'Dynamic',
  collider: {
    shape: 'Rectangle',
    size: { x: 32, y: 32 },
    offset: { x: 0, y: 0 },
    density: 1,
    friction: 0.3,
    isSensor: false,
  },
}

export const PHYSICS_INSPECTOR = {
  key: 'physics' as const,
  label: 'Physics (Box2D Body)',
  color: 'var(--blue)',
  description:
    'Explicit collider for Box2D. Not required for Platformer Controller (transform-only). With platformer, body is kinematic for collisions only. Solid and Sensor create bodies without this block.',
}
