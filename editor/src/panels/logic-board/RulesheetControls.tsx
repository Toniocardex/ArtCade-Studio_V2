import type { ProjectDoc, EntityDef } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { classDisplayLabel, findLogicBoardForEntity } from '../../utils/project'

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
    <div className="flex-shrink-0 flex flex-col gap-2 px-4 py-2 border-b border-[var(--border)] bg-[var(--panel)]">
      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-[11px] text-[var(--muted)]">Rules for entity</span>
        <select
          className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs min-w-[140px]"
          value={selectedEntityId ?? ''}
          onChange={(e) => {
            const id = Number(e.target.value)
            if (!Number.isNaN(id)) onSelectEntity(id)
          }}
        >
          <option value="">Choose entity…</option>
          {sceneEntities.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
              {findLogicBoardForEntity(project, e.id) ? ' · rules' : ''}
            </option>
          ))}
        </select>
        <button
          type="button"
          disabled={!canCreateForSelection}
          title={
            selectedEntityId == null
              ? 'Select an entity in the Scenes panel first'
              : boardForSelection
                ? 'This entity already has a rulesheet'
                : 'Create rulesheet for selected entity'
          }
          onClick={() => {
            if (selectedEntityId != null) onCreateForEntity(selectedEntityId)
          }}
          className="px-3 py-1 rounded text-xs font-semibold border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] disabled:opacity-40"
        >
          New rulesheet for selection
        </button>
        {board && (
          <button
            type="button"
            onClick={onDeleteBoard}
            className="px-3 py-1 rounded text-xs text-[var(--muted)] hover:text-[var(--danger)]"
          >
            Delete rulesheet
          </button>
        )}
      </div>

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="text-xs"
      >
        <summary className="cursor-pointer text-[var(--muted)] hover:text-[var(--text)] select-none">
          Advanced — shared rulesheet (class)
        </summary>
        <p className="text-[10px] text-[var(--muted)] mt-1 mb-2 max-w-xl">
          Use only when many identical objects share one behavior. Default workflow is one rulesheet per entity in the Scenes panel.
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="bg-[var(--bg)] border border-[var(--border-2)] text-[var(--accent)] px-2 py-1 rounded text-xs"
            value={newClass}
            onChange={(e) => setNewClass(e.target.value)}
          >
            <option value="">Choose class…</option>
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
            className="px-3 py-1 rounded text-xs font-semibold border border-[var(--border-2)] bg-[var(--border)] text-[var(--text)] disabled:opacity-40"
          >
            New class rulesheet
          </button>
        </div>
      </details>
    </div>
  )
}
