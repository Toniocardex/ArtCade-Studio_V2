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
  label: 'Physics (Collider)',
  color: 'var(--blue)',
  description:
    'Explicit collider for overlap, raycast, falling objects, or a custom Top-Down hitbox. Top-Down uses object bounds automatically. Platformer movement is transform-only; with Physics its body is kinematic for collisions. Solid and Sensor create bodies without this block.',
}
