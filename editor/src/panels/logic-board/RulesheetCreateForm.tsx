// ---------------------------------------------------------------------------
// RulesheetCreateForm — entity picker + create/open CTA, plus the Advanced
// shared-class section. Rendered in the Logic Board empty state and in the
// "New rulesheet" modal.
// ---------------------------------------------------------------------------

import { useState } from 'react'
import { Box } from 'lucide-react'
import type { ProjectDoc, EntityDef } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { classDisplayLabel, findLogicBoardForInstance } from '../../utils/project'
import { EditorSelect } from '../../components/ui/EditorSelect'
import { editorCtaFilled } from '../../components/ui/editor-ui-classes'

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
  onCreateRulesheet: (entityId: number) => void
  onOpenRulesheet: (boardId: string) => void
  onGoToCanvas: () => void
  onCreateClassRulesheet: () => void
}>

function AdvancedClassSection({
  classes,
  newClass,
  setNewClass,
  onCreateClassRulesheet,
  project,
}: Readonly<{
  classes: string[]
  newClass: string
  setNewClass: (className: string) => void
  onCreateClassRulesheet: () => void
  project: ProjectDoc
}>) {
  const [advancedOpen, setAdvancedOpen] = useState(false)

  return (
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
      {classes.length === 0 ? (
        <p className="text-[10px] text-[var(--muted)] italic">
          No object classes in this project.
        </p>
      ) : (
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
      )}
    </details>
  )
}

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
  onCreateRulesheet,
  onOpenRulesheet,
  onGoToCanvas,
  onCreateClassRulesheet,
}: RulesheetCreateFormProps) {
  const hasSceneObjects = sceneEntities.length > 0

  if (!hasSceneObjects) {
    return (
      <div className="flex flex-col gap-4 text-left">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-2 text-[var(--muted)]">
            <Box size={16} aria-hidden />
            <p className="text-sm font-semibold text-[var(--primary)]">
              No objects in this scene
            </p>
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--muted)]">
            Add objects in the Canvas module, then return here to create a rulesheet.
          </p>
          <button
            type="button"
            onClick={onGoToCanvas}
            className={`inline-flex w-fit items-center gap-1.5 rounded px-4 py-1.5 text-xs font-semibold ${editorCtaFilled}`}
          >
            Go to Canvas
          </button>
        </div>

        <hr className="border-[var(--outline)]" />

        <AdvancedClassSection
          classes={classes}
          newClass={newClass}
          setNewClass={setNewClass}
          onCreateClassRulesheet={onCreateClassRulesheet}
          project={project}
        />
      </div>
    )
  }

  const hasRulesheetForSelection = boardForSelection != null

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
          {hasRulesheetForSelection ? (
            <button
              type="button"
              title="Open the rulesheet for this object type"
              onClick={() => onOpenRulesheet(boardForSelection.boardId)}
              className="rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)]"
            >
              Open rulesheet
            </button>
          ) : (
            <button
              type="button"
              disabled={!canCreateForSelection}
              title={
                selectedEntityId == null
                  ? 'Select an object first'
                  : 'Create a rulesheet for the selected object type'
              }
              onClick={() => {
                if (selectedEntityId != null) onCreateRulesheet(selectedEntityId)
              }}
              className="rounded border border-[var(--accent-bd)] bg-[var(--accent-bg)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-fg-on-bg)] hover:bg-[var(--accent-bg-h)] disabled:opacity-40 disabled:pointer-events-none"
            >
              Create rulesheet
            </button>
          )}
        </div>
      </div>

      <AdvancedClassSection
        classes={classes}
        newClass={newClass}
        setNewClass={setNewClass}
        onCreateClassRulesheet={onCreateClassRulesheet}
        project={project}
      />
    </div>
  )
}
