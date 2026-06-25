import type { PhysicsComponent } from '../../types'

export const DEFAULT_PHYSICS: PhysicsComponent = {
  bodyType: 'Dynamic',
  collider: {
    shape: 'Rectangle',
    size: { x: 32, y: 32 },
    offset: { x: 0, y: 0 },
    density: 1,
    friction: 0.3,
  },
}

export const PHYSICS_INSPECTOR = {
  key: 'physics' as const,
  label: 'Physics (Collider)',
  color: 'var(--accent)',
  description:
    'Arcade physics state for explicit dynamic bodies. Gameplay collision shapes live in Collision Body.',
}
