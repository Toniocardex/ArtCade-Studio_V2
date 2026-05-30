import type { EntityDef } from '../../types'
import { SectionCollapse } from '../../components/ui/SectionCollapse'

export type EntityMetadataSectionProps = Readonly<{
  entity: EntityDef
}>

export function EntityMetadataSection({ entity }: EntityMetadataSectionProps) {
  return (
    <SectionCollapse title="Metadata" defaultOpen={false}>
      <dl className="text-[10px] space-y-1.5 text-[var(--primary-soft)]">
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted)]">Entity ID</dt>
          <dd className="font-mono">{entity.id}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted)]">Class</dt>
          <dd className="font-mono truncate">{entity.className}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted)]">Render order</dt>
          <dd>{entity.sprite.renderOrder}</dd>
        </div>
        <div className="flex justify-between gap-2">
          <dt className="text-[var(--muted)]">Visible</dt>
          <dd>{entity.visible === false ? 'No' : 'Yes'}</dd>
        </div>
      </dl>
    </SectionCollapse>
  )
}
