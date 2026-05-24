import type { ComponentKey, EntityDef } from '../../types'
import { COMPONENT_REGISTRY, type ComponentDescriptor } from './component-registry'

export function componentBlockId(key: ComponentKey): string {
  return `inspector-component-${key}`
}

export function activeComponentDescriptors(entity: EntityDef): ComponentDescriptor[] {
  const record = entity as unknown as Record<string, unknown>
  return COMPONENT_REGISTRY.filter((d) => record[d.key] != null)
}

export function scrollToComponentBlock(key: ComponentKey): void {
  document.getElementById(componentBlockId(key))?.scrollIntoView({
    behavior: 'smooth',
    block: 'start',
  })
}
