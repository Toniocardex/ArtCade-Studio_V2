// @vitest-environment happy-dom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { useEffect } from 'react'
import type { ComponentProps } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { EditorProvider, useEditorDispatch, useEditorSelector } from '../store/editor-store'
import { createBlankProject } from '../utils/project-factory'
import { runtimeSync } from '../utils/runtime-sync-service'
import { usePreviewPlayStop } from './usePreviewPlayStop'

const isTauriMock = vi.fn(() => false)
const openRuntimePreviewSessionMock = vi.fn(async (_size: unknown, _bundle: unknown) => undefined)
const closeRuntimePreviewSessionMock = vi.fn(async () => undefined)

vi.mock('@tauri-apps/api/core', () => ({
  isTauri: () => isTauriMock(),
}))

vi.mock('../utils/runtime-preview-window', () => ({
  closeRuntimePreviewSession: () => closeRuntimePreviewSessionMock(),
  openRuntimePreviewSession: (size: unknown, bundle: unknown) =>
    openRuntimePreviewSessionMock(size, bundle),
}))

function Harness({
  project,
  initialPlaying = false,
}: Readonly<{
  project: ReturnType<typeof createBlankProject>
  initialPlaying?: boolean
}>) {
  const dispatch = useEditorDispatch()
  const handlePlayStop = usePreviewPlayStop()
  const loaded = useEditorSelector((s) => s.project != null)
  const playing = useEditorSelector((s) => s.isPlaying)

  useEffect(() => {
    dispatch({ type: 'LOAD_PROJECT', project, path: '' })
    if (initialPlaying) dispatch({ type: 'SET_PLAYING', playing: true })
  }, [dispatch, initialPlaying, project])

  return (
    <>
      <button type="button" disabled={!loaded} onClick={handlePlayStop}>toggle</button>
      <span data-testid="playing">{String(playing)}</span>
    </>
  )
}

function renderHarness(props?: Partial<ComponentProps<typeof Harness>>) {
  const project = props?.project ?? createBlankProject('Preview Test')
  return render(
    <EditorProvider>
      <Harness {...props} project={project} />
    </EditorProvider>,
  )
}

describe('usePreviewPlayStop', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    isTauriMock.mockReturnValue(false)
    openRuntimePreviewSessionMock.mockClear()
    closeRuntimePreviewSessionMock.mockClear()
  })

  afterEach(() => {
    cleanup()
  })

  it('opens a native runtime preview in Tauri without calling docked transition', async () => {
    isTauriMock.mockReturnValue(true)
    const transitionSpy = vi.spyOn(runtimeSync, 'transitionPreview')
    renderHarness()

    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false))
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(openRuntimePreviewSessionMock).toHaveBeenCalledTimes(1))
    expect(transitionSpy).not.toHaveBeenCalled()
    expect(openRuntimePreviewSessionMock.mock.calls[0]?.[0]).toEqual({ x: 512, y: 320 })
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('true'))
  })

  it('uses the docked transition in browser mode', async () => {
    const transitionSpy = vi.spyOn(runtimeSync, 'transitionPreview').mockReturnValue({
      ok: true,
      code: 0,
      nextPlaying: true,
    })
    renderHarness()

    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false))
    fireEvent.click(screen.getByRole('button'))

    expect(openRuntimePreviewSessionMock).not.toHaveBeenCalled()
    expect(transitionSpy).toHaveBeenCalledWith('play', expect.objectContaining({
      activeSceneId: 'scene_main',
    }))
  })

  it('blocks native preview when the active scene is missing', async () => {
    isTauriMock.mockReturnValue(true)
    const project = {
      ...createBlankProject('Broken Preview'),
      activeSceneId: 'missing_scene',
    }
    renderHarness({ project })

    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false))
    fireEvent.click(screen.getByRole('button'))

    expect(openRuntimePreviewSessionMock).not.toHaveBeenCalled()
  })

  it('closes the native runtime preview on stop', async () => {
    isTauriMock.mockReturnValue(true)
    renderHarness({ initialPlaying: true })

    await waitFor(() => expect(screen.getByRole<HTMLButtonElement>('button').disabled).toBe(false))
    fireEvent.click(screen.getByRole('button'))

    await waitFor(() => expect(closeRuntimePreviewSessionMock).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(screen.getByTestId('playing').textContent).toBe('false'))
  })
})
