import type { ProjectDoc, EntityDef } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { classDisplayLabel, findLogicBoardForInstance } from '../../utils/project'

interface RulesheetControlsProps {
  project: ProjectDoc
  board: LogicBoard | null
  sceneEntities: EntityDef[]
  selectedEntityId: number | null
  boardForSelection: LogicBoard | undefined
  canCreateForSelection: boolean
  advancedOpen: boolean
  setAdvancedOpen: (open: boolean) => void
  classes: string[]
  newClass: string
  setNewClass: (className: string) => void
  onSelectEntity: (entityId: number) => void
  onCreateForEntity: (entityId: number) => void
  onCreateClassRulesheet: () => void
  onDeleteBoard: () => void
}

export function RulesheetControls({
  project,
  board,
  sceneEntities,
  selectedEntityId,
  boardForSelection,
  canCreateForSelection,
  advancedOpen,
  setAdvancedOpen,
  classes,
  newClass,
  setNewClass,
  onSelectEntity,
  onCreateForEntity,
  onCreateClassRulesheet,
  onDeleteBoard,
}: RulesheetControlsProps) {
  return (
    <div className="flex-shrink-0 flex flex-col gap-2 border-b border-[var(--outline)] bg-[var(--surface)]">
      <header className="flex items-center justify-between gap-2 px-3 py-2 border-b border-[var(--outline-subtle)]">
        <div className="min-w-0">
          <p className="text-[9px] font-semibold uppercase tracking-widest text-[var(--muted)]">
            Rulesheet Browser
          </p>
          <p className="truncate text-[10px] text-[var(--primary-soft)]">
            {board ? 'Object rulesheet selected' : 'Select or create rules'}
          </p>
        </div>
        {board && (
          <button
            type="button"
            onClick={onDeleteBoard}
            className="shrink-0 rounded border border-[var(--outline)] px-2 py-1 text-[10px] text-[var(--muted)] hover:border-[var(--danger)] hover:text-[var(--danger)]"
          >
            Delete
          </button>
        )}
      </header>

      <div className="flex flex-col gap-2 px-3 py-2">
        <span className="text-[10px] text-[var(--muted)]">Entity</span>
        <select
          className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--primary-soft)] px-2 py-1 rounded text-xs min-w-[140px]"
          value={selectedEntityId ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value)
            if (!Number.isNaN(id)) onSelectEntity(id)
          }}
        >
          <option value="">Choose entity...</option>
          {sceneEntities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {findLogicBoardForInstance(project, e.id) ? ' / rules' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canCreateForSelection}
          title={
            selectedEntityId == null
              ? 'Select an object in the Scenes panel first'
              : boardForSelection
                ? 'This object type already has a rulesheet'
                : 'Create rulesheet for the selected object type'
          }
          onClick={() => {
            if (selectedEntityId != null) onCreateForEntity(selectedEntityId)
          }}
          className="px-3 py-1 rounded text-xs font-semibold border border-[var(--outline)] bg-[var(--surface-2)] text-[var(--text)] disabled:opacity-40"
        >
          New rulesheet
        </button>
      </div>

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="px-3 pb-2 text-xs"
      >
        <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)] select-none">
          Advanced - shared class rulesheet
        </summary>
        <p className="text-[10px] text-[var(--muted)] mt-1 mb-2 max-w-xl">
          Rules apply to every object of the same type. For a variant (e.g. a gold coin), create a new object type and give it its own rulesheet.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--primary-soft)] px-2 py-1 rounded text-xs"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
          >
            <option value="">Choose class...</option>
            {classes.map((c) => (
              <option key={c} value={c}>
                {classDisplayLabel(project, c)}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={!newClass}
            onClick={onCreateClassRulesheet}
            className="px-3 py-1 rounded text-xs font-semibold border border-[var(--outline)] bg-[var(--surface-2)] text-[var(--text)] disabled:opacity-40"
          >
            New class rulesheet
          </button>
        </div>
      </details>
    </div>
  )
}
