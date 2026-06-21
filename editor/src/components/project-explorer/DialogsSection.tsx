import { MessageSquare } from 'lucide-react'
import { TreeSection } from './TreeSection'
import { TreeLeaf } from './TreeNode'

export type DialogsSectionProps = Readonly<{
  dialogs: Readonly<Record<string, unknown>>
  open: boolean
  onToggle: () => void
  onOpenDialog: (dialogId: string) => void
}>

/** Dialog-script leaves under the explorer's "Dialogs" tree section. */
export function DialogsSection({ dialogs, open, onToggle, onOpenDialog }: DialogsSectionProps) {
  const dialogIds = Object.keys(dialogs)
  return (
    <TreeSection title="Dialogs" open={open} onToggle={onToggle}>
      {dialogIds
        .sort((a, b) => a.localeCompare(b))
        .map((dialogId) => (
          <TreeLeaf
            key={dialogId}
            label={dialogId}
            depth={1}
            onClick={() => onOpenDialog(dialogId)}
            icon={<MessageSquare size={11} className="flex-shrink-0 text-[var(--accent)]" />}
            title={`dialogs/${dialogId}.json`}
          />
        ))}
      {dialogIds.length === 0 ? (
        <p className="px-3 py-2 text-[10px] text-[var(--muted)]">No dialog scripts yet. Use View → Dialog library…</p>
      ) : null}
    </TreeSection>
  )
}
