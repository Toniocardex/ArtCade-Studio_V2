import { useId, useState } from 'react'
import { HelpCircle } from 'lucide-react'

const SHORTCUTS: ReadonlyArray<{ keys: string; action: string }> = [
  { keys: 'Click', action: 'Select rule' },
  { keys: 'Double-click / Enter', action: 'Edit rule' },
  { keys: 'Escape', action: 'Close editor' },
  { keys: '↑ / ↓', action: 'Move selection' },
  { keys: 'Alt + ↑ / ↓', action: 'Reorder selected rule' },
  { keys: 'Delete / Backspace', action: 'Delete selected rule' },
  { keys: 'Ctrl+D', action: 'Duplicate rule' },
  { keys: 'Ctrl+C / Ctrl+V', action: 'Copy / paste rule' },
  { keys: 'Ctrl+Z / Ctrl+Shift+Z', action: 'Undo / redo Logic Board' },
  { keys: 'Drag grip', action: 'Reorder rule' },
  { keys: 'Apply to game', action: 'Hot-reload logic into preview' },
]

export function LogicBoardShortcutsHelp() {
  const [open, setOpen] = useState(false)
  const panelId = useId()

  return (
    <div className="relative">
      <button
        type="button"
        className="inline-flex items-center gap-1 text-[10px] text-[var(--muted)] hover:text-[var(--accent)]"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <HelpCircle size={12} aria-hidden />
        Shortcuts
      </button>
      {open && (
        <div
          id={panelId}
          role="dialog"
          aria-label="Logic Board shortcuts"
          className="absolute left-0 top-full z-20 mt-1 w-72 rounded border border-[var(--border-2)] bg-[var(--panel)] p-2 shadow-lg"
        >
          <table className="w-full text-[10px] text-[var(--text)]">
            <tbody>
              {SHORTCUTS.map((row) => (
                <tr key={row.keys} className="border-b border-[var(--border)] last:border-0">
                  <td className="py-1 pr-2 font-mono text-[var(--accent)] whitespace-nowrap">
                    {row.keys}
                  </td>
                  <td className="py-1 text-[var(--muted)]">{row.action}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
