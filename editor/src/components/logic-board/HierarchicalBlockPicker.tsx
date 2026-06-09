import { useEffect, useMemo, useState } from 'react'
import type { ComponentKind } from '../../utils/logic-board/schema-registry'
import type { LogicActionType, LogicCondition, LogicTriggerType } from '../../types/logic-board'
import {
  actionHierarchy,
  conditionHierarchy,
  triggerHierarchy,
  type HierarchicalNode,
} from '../../utils/logic-board/hierarchical-picker-map'

export type HierarchicalBlockPickerProps = Readonly<{
  kind: ComponentKind
  types: readonly string[]
  onPick: (type: string) => void
  onClose: () => void
  title: string
  /** When true, a single click on a block row confirms the pick (browse overlays). */
  pickOnSelect?: boolean
}>

function flattenLeaves(nodes: readonly HierarchicalNode[]): HierarchicalNode[] {
  const out: HierarchicalNode[] = []
  for (const n of nodes) {
    if (n.children && n.children.length > 0) out.push(...n.children)
    else out.push(n)
  }
  return out
}

export function HierarchicalBlockPicker({
  kind,
  types,
  onPick,
  onClose,
  title,
  pickOnSelect = false,
}: HierarchicalBlockPickerProps) {
  const tree = useMemo(() => {
    if (kind === 'trigger') return triggerHierarchy(types as LogicTriggerType[])
    if (kind === 'action') return actionHierarchy(types as LogicActionType[])
    return conditionHierarchy(types as LogicCondition['type'][])
  }, [kind, types])

  const [categoryId, setCategoryId] = useState('')
  const [blockId, setBlockId] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    const firstCat = tree[0]?.id ?? ''
    const firstBlock = tree[0]?.children?.[0]?.id ?? flattenLeaves(tree)[0]?.id ?? ''
    setCategoryId(firstCat)
    setBlockId(firstBlock)
    setQuery('')
  }, [kind, types, tree])

  const category = tree.find((n) => n.id === categoryId) ?? tree[0]
  const blocks = category?.children ?? flattenLeaves(tree)

  const filteredBlocks = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return blocks
    return blocks.filter((b) => b.label.toLowerCase().includes(q))
  }, [blocks, query])

  const selected = filteredBlocks.find((b) => b.id === blockId) ?? filteredBlocks[0]

  return (
    <div
      className="flex flex-col h-full min-h-0 border-l border-[var(--outline)] bg-[var(--surface)] w-full shrink-0"
      data-testid="hierarchical-block-picker"
    >
      <header className="shrink-0 px-3 py-2 border-b border-[var(--outline)] flex items-center gap-2">
        <span className="text-[11px] font-semibold text-[var(--primary)] flex-1">{title}</span>
        <button type="button" className="text-[10px] text-[var(--muted)] hover:text-[var(--primary)]" onClick={onClose}>
          Close
        </button>
      </header>
      <input
        className="mx-2 mt-2 text-xs px-2 py-1 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--void)] text-[var(--primary)]"
        placeholder="Search…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="flex flex-1 min-h-[240px] border-t border-[var(--outline-subtle)] mt-2">
        <div className="w-[42%] min-w-[9rem] border-r border-[var(--outline-faint)] overflow-auto panel-scroll">
          {tree.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-[11px] leading-snug truncate ${
                cat.id === category?.id
                  ? 'bg-[var(--outline)] text-[var(--primary)]'
                  : 'text-[var(--muted)] hover:bg-[var(--outline-faint)]'
              }`}
              onClick={() => {
                setCategoryId(cat.id)
                const first = cat.children?.[0]?.id ?? ''
                setBlockId(first)
              }}
            >
              {cat.label}
            </button>
          ))}
        </div>
        <div className="flex-1 min-w-0 overflow-auto panel-scroll">
          {filteredBlocks.map((block) => (
            <button
              key={block.id}
              type="button"
              className={`w-full text-left px-3 py-2 text-[11px] leading-snug ${
                block.id === selected?.id
                  ? 'bg-[var(--accent-muted)] text-[var(--primary)]'
                  : 'text-[var(--primary-soft)] hover:bg-[var(--outline-faint)]'
              }`}
              onClick={() => {
                setBlockId(block.id)
                if (pickOnSelect) onPick(block.id)
              }}
              onDoubleClick={pickOnSelect ? undefined : () => onPick(block.id)}
            >
              {block.label}
            </button>
          ))}
        </div>
      </div>
      <footer className="shrink-0 p-2 border-t border-[var(--outline)] flex gap-2">
        <button
          type="button"
          disabled={!selected}
          className="flex-1 text-xs py-1.5 rounded-[var(--radius)] border border-[var(--outline)] bg-[var(--void)] hover:bg-[var(--outline)] disabled:opacity-50"
          onClick={() => selected && onPick(selected.id)}
        >
          Add
        </button>
      </footer>
      {selected ? (
        <p className="px-3 pb-2 text-[9px] text-[var(--muted)]">{selected.label}</p>
      ) : null}
    </div>
  )
}
