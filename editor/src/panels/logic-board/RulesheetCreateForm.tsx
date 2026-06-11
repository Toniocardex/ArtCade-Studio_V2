// ---------------------------------------------------------------------------
// RulesheetCreateForm — entity picker + create CTA, plus the Advanced
// shared-class section. Rendered in the Logic Board empty state and in the
// "New rulesheet" modal.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import type { ProjectDoc, EntityDef } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { classDisplayLabel, findLogicBoardForInstance } from '../../utils/project'
import { EditorSelect } from '../../components/ui/EditorSelect'

export type RulesheetCreateFormProps = Readonly<{
  project: ProjectDoc
  sceneEntities: EntityDef[]
  selectedEntityId: number | null
  boardForSelection: LogicBoard | undefined
  canCreateForSelection: boolean
  classes: string[]
  newClass: string
  setNewClass: (className: string) => void
  onSelectEntity: (entityId: number) => void
  onCreateForEntity: (entityId: number) => void
  onCreateClassRulesheet: () => void
}>

export function RulesheetCreateForm({
  project,
  sceneEntities,
  selectedEntityId,
  boardForSelection,
  canCreateForSelection,
  classes,
  newClass,
  setNewClass,
  onSelectEntity,
  onCreateForEntity,
  onCreateClassRulesheet,
}: RulesheetCreateFormProps) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
    <div className="flex flex-col gap-3 text-left">
      <div className="flex flex-col gap-1.5">
        <span className="text-[10px] text-[var(--muted)]">Object</span>
        <div className="flex flex-wrap items-center gap-2">
          <EditorSelect
            className="w-auto min-w-[160px]"
            triggerClassName="py-1.5"
            value={selectedEntityId != null ? String(selectedEntityId) : ''}
            onChange={(v) => {
              const id = Number(v)
              if (v !== '' && !Number.isNaN(id)) onSelectEntity(id)
            }}
            placeholder="Choose object..."
            options={sceneEntities.map((e) => ({
              value: String(e.id),
              label: `${e.name}${findLogicBoardForInstance(project, e.id) ? ' / has rules' : ''}`,
            }))}
            aria-label="Object"
          />
          <button
            type="button"
            disabled={!canCreateForSelection}
            title={
              selectedEntityId == null
                ? 'Select an object first'
                : boardForSelection
                  ? 'This object type already has a rulesheet'
                  : 'Create a rulesheet for the selected object type'
            }
            onClick={() => {
              if (selectedEntityId != null) onCreateForEntity(selectedEntityId)
            }}
            className="rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)] disabled:opacity-40 disabled:pointer-events-none"
          >
            Create rulesheet
          </button>
        </div>
        {sceneEntities.length === 0 && (
          <p className="text-[10px] text-[var(--muted)]">
            No objects in this scene yet — insert one in the Canvas module first.
          </p>
        )}
      </div>

      <details
        open={advancedOpen}
        onToggle={(e) => setAdvancedOpen((e.target as HTMLDetailsElement).open)}
        className="text-xs"
      >
        <summary className="cursor-pointer select-none text-[var(--muted)] hover:text-[var(--text)]">
          Advanced — shared class rulesheet
        </summary>
        <p className="mb-2 mt-1 max-w-xl text-[10px] text-[var(--muted)]">
          Rules apply to every object of the same type. For a variant (e.g. a gold coin),
          create a new object type and give it its own rulesheet.
        </p>
        <div className="flex flex-wrap items-center gap-2">
          <EditorSelect
            className="w-auto min-w-[9rem]"
            triggerClassName="py-1"
            value={newClass}
            onChange={setNewClass}
            placeholder="Choose class..."
            options={classes.map((c) => ({
              value: c,
              label: classDisplayLabel(project, c),
            }))}
            aria-label="Class"
          />
          <button
            type="button"
            disabled={!newClass}
            onClick={onCreateClassRulesheet}
            className="rounded border border-[var(--outline)] bg-[var(--surface-2)] px-3 py-1 text-xs font-semibold text-[var(--text)] disabled:opacity-40"
          >
            New class rulesheet
          </button>
        </div>
      </details>
    </div>
  )
}
