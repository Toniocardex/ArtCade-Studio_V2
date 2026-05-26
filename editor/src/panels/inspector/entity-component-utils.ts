import type { ComponentKey, EntityDef } from '../../types'
import { COMPONENT_REGISTRY, type ComponentDescriptor } from './component-registry'
import { PHYSICS_INSPECTOR } from './physics-defaults'

export type InspectorBlockKey = ComponentKey | 'physics'

export function componentBlockId(key: InspectorBlockKey): string {
  return `inspector-component-${key}`
}

export function activeComponentDescriptors(
  entity: EntityDef,
): Array<ComponentDescriptor | typeof PHYSICS_INSPECTOR> {
  const record = entity as unknown as Record<string, unknown>
  const ecs = COMPONENT_REGISTRY.filter((d) => record[d.key] != null)
  return entity.physics ? [...ecs, PHYSICS_INSPECTOR] : ecs
}

export function scrollToComponentBlock(key: InspectorBlockKey): void {
  document.getElementById(componentBlockId(key))?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}
