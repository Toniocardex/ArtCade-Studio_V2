/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup, fireEvent } from '@testing-library/react'
import type { ProjectDoc, EntityDef } from '../../types'
import type { LogicBoard } from '../../types/logic-board'
import { createLogicBoardForObjectType } from '../../utils/logic-board/factory'
import { RulesheetCreateForm } from './RulesheetCreateForm'

function makeEntity(id: number, name: string, className: string): EntityDef {
  return {
    id,
    name,
    className,
    tags: [],
    transform: {
      position: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      rotation: 0,
    },
    visible: true,
  }
}

function makeProject(entities: EntityDef[], logicBoards: LogicBoard[] = []): ProjectDoc {
  const entityIds = entities.map((e) => e.id)
  const entitiesMap = Object.fromEntries(entities.map((e) => [e.id, e]))
  return {
    projectName: 'Test',
    version: '2.0.0',
    targetFPS: 60,
    activeSceneId: 's',
    mainScriptPath: 'scripts/main.lua',
    entities: entitiesMap,
    scenes: {
      s: {
        id: 's',
        name: 'Scene',
        worldSize: { x: 800, y: 600 },
        viewportSize: { x: 800, y: 600 },
        backgroundColor: { x: 0, y: 0, z: 0, w: 1 },
        entityIds,
      },
    },
    logicBoards,
  }
}

function baseProps(overrides: Partial<Parameters<typeof RulesheetCreateForm>[0]> = {}) {
  const onGoToCanvas = vi.fn()
  const onCreateRulesheet = vi.fn()
  const onOpenRulesheet = vi.fn()
  const onCreateClassRulesheet = vi.fn()
  const onSelectEntity = vi.fn()

  return {
    project: makeProject([]),
    sceneEntities: [] as EntityDef[],
    selectedEntityId: null,
    boardForSelection: undefined,
    canCreateForSelection: false,
    classes: [] as string[],
    newClass: '',
    setNewClass: vi.fn(),
    onSelectEntity,
    onCreateRulesheet,
    onOpenRulesheet,
    onGoToCanvas,
    onCreateClassRulesheet,
    ...overrides,
  }
}

describe('RulesheetCreateForm', () => {
  afterEach(() => cleanup())

  it('shows empty state without Object combobox when scene has no objects', () => {
    const props = baseProps()
    render(<RulesheetCreateForm {...props} />)

    expect(screen.queryByRole('combobox', { name: 'Object' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Go to Canvas' })).toBeDefined()
  })

  it('calls onGoToCanvas when Go to Canvas is clicked', () => {
    const props = baseProps()
    render(<RulesheetCreateForm {...props} />)

    fireEvent.click(screen.getByRole('button', { name: 'Go to Canvas' }))
    expect(props.onGoToCanvas).toHaveBeenCalledOnce()
  })

  it('shows Object combobox and Create rulesheet when scene has objects', () => {
    const player = makeEntity(1, 'Player', 'Player')
    const props = baseProps({
      project: makeProject([player]),
      sceneEntities: [player],
      classes: ['Player'],
    })
    render(<RulesheetCreateForm {...props} />)

    expect(screen.getByRole('combobox', { name: 'Object' })).toBeDefined()
    expect(screen.getByRole('button', { name: 'Create rulesheet' })).toBeDefined()
    expect(screen.queryByRole('button', { name: 'Open rulesheet' })).toBeNull()
  })

  it('shows Open rulesheet when selection already has a board', () => {
    const player = makeEntity(1, 'Player', 'Player')
    const board = createLogicBoardForObjectType('Player', 'board_player')
    const props = baseProps({
      project: makeProject([player], [board]),
      sceneEntities: [player],
      selectedEntityId: 1,
      boardForSelection: board,
      classes: ['Player'],
    })
    render(<RulesheetCreateForm {...props} />)

    const openBtn = screen.getByRole('button', { name: 'Open rulesheet' })
    expect(openBtn).toBeDefined()
    fireEvent.click(openBtn)
    expect(props.onOpenRulesheet).toHaveBeenCalledWith('board_player')
  })

  it('shows Advanced message instead of Class combobox when no classes exist', () => {
    const props = baseProps()
    render(<RulesheetCreateForm {...props} />)

    expect(screen.queryByRole('combobox', { name: 'Class' })).toBeNull()
    expect(screen.getByText('No object classes in this project.')).toBeDefined()
  })
})
