/**
 * @vitest-environment happy-dom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { SceneContextBar } from './SceneContextBar'

const scenes = [
  { sceneId: 'start', name: 'Start', isStartScene: true },
  { sceneId: 'side', name: 'Side Room', isStartScene: false },
]

function sceneActions() {
  return {
    project: null,
    sceneId: 'start',
    scene: { id: 'start', name: 'Start' },
    selection: { entityId: null, sceneId: 'start' },
    isStartScene: true,
    canDeleteScene: false,
    canPasteEntity: false,
    sceneCount: scenes.length,
    addScene: vi.fn(),
    selectScene: vi.fn(),
    setStartScene: vi.fn(),
    setStartSceneById: vi.fn(),
    deleteScene: vi.fn(),
    deleteSceneById: vi.fn(),
    renameScene: vi.fn(),
    renameSceneById: vi.fn(),
    duplicateSceneById: vi.fn(),
    insertObject: vi.fn(),
    addInstanceOfType: vi.fn(),
    selectEntity: vi.fn(),
    toggleEntityVisible: vi.fn(),
    copyEntity: vi.fn(),
    pasteEntity: vi.fn(),
    duplicateEntity: vi.fn(),
    requestDeleteObject: vi.fn(),
    openEntityLogic: vi.fn(),
    renameEntity: vi.fn(),
  }
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe('SceneContextBar', () => {
  it('dispatches inline scene row actions', () => {
    const scene = sceneActions()
    render(
      <SceneContextBar
        scenes={scenes}
        visible
        scene={scene as never}
        setContextMenu={() => {}}
      />,
    )

    fireEvent.click(screen.getByText('Side Room'))
    fireEvent.click(screen.getByLabelText('Set as start scene'))
    fireEvent.click(screen.getAllByLabelText('Duplicate scene')[1])
    fireEvent.click(screen.getAllByLabelText('Rename scene')[1])
    fireEvent.click(screen.getByLabelText('Delete scene'))

    expect(scene.selectScene).toHaveBeenCalledWith('side')
    expect(scene.setStartSceneById).toHaveBeenCalledWith('side')
    expect(scene.duplicateSceneById).toHaveBeenCalledWith('side')
    expect(scene.renameSceneById).toHaveBeenCalledWith('side')
    expect(scene.deleteSceneById).toHaveBeenCalledWith('side')
  })
})
