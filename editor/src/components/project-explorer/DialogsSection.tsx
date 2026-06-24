import { Library, MessageSquare } from 'lucide-react'
import { TreeSection } from './TreeSection'
import { TreeLeaf } from './TreeNode'
import { ExplorerRowAction } from './explorer-cta'
import { ExplorerEmptyState } from './ExplorerEmptyState'

export type DialogsSectionProps = Readonly<{
  dialogs: Readonly<Record<string, unknown>>
  open: boolean
  onToggle: () => void
  onOpenLibrary: () => void
  onOpenDialog: (dialogId: string) => void
}>

/** Dialog-script leaves under the explorer's "Dialogs" tree section. */
export function DialogsSection({
  dialogs,
  open,
  onToggle,
  onOpenLibrary,
  onOpenDialog,
}: DialogsSectionProps) {
  const dialogIds = Object.keys(dialogs)
  return (
    <TreeSection
      title={`Dialogs${dialogIds.length > 0 ? ` (${dialogIds.length})` : ''}`}
      open={open}
      onToggle={onToggle}
      actions={
        <ExplorerRowAction
          title="Open Dialog library"
          tone="accent"
          onClick={(ev) => {
            ev.stopPropagation()
            onOpenLibrary()
          }}
        >
          <Library size={13} />
        </ExplorerRowAction>
      }
    >
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
        <ExplorerEmptyState
          title="No dialog scripts yet"
          detail="Open the library to create the first dialog."
        />
      ) : null}
    </TreeSection>
  )
}
