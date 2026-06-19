import { useState, type ReactNode } from 'react'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import { CatalogPicker } from './CatalogPicker'

const defaultButtonClassName =
  'inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] hover:border-[var(--accent-bd)]'

export type CatalogSelectButtonProps = Readonly<{
  kind: ComponentKind
  label: string
  buttonTitle: string
  buttonClassName?: string
  icon?: ReactNode
  title: string
  subtitle?: string
  searchPlaceholder?: string
  types: readonly string[]
  recommendedTypes?: readonly string[]
  onPick: (type: string) => void
}>

export function CatalogSelectButton({
  kind,
  label,
  buttonTitle,
  buttonClassName = defaultButtonClassName,
  icon,
  title,
  subtitle,
  searchPlaceholder,
  types,
  recommendedTypes,
  onPick,
}: CatalogSelectButtonProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        type="button"
        className={buttonClassName}
        title={buttonTitle}
        onClick={() => setOpen(true)}
      >
        {icon}
        <span className="truncate">{label}</span>
      </button>
      {open && (
        <CatalogPicker
          kind={kind}
          title={title}
          subtitle={subtitle}
          searchPlaceholder={searchPlaceholder}
          types={types}
          recommendedTypes={recommendedTypes}
          onPick={(type) => {
            onPick(type)
            setOpen(false)
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  )
}
