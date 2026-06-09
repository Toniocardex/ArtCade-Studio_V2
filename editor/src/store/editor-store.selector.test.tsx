/**
 * @vitest-environment happy-dom
 */
// editor-store.selector.test.tsx
//
// Wave 0 baseline (automated): legacy useEditor() re-renders on unrelated core
// updates (e.g. editorZoom). useEditorSelector / useEditorDispatch isolate
// subscriptions. Manual React Profiler baseline: drag entity, tile paint, Logic
// Board typing — compare before/after Wave 2.

import { describe, it, expect, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useRef } from 'react'
import {
  EditorProvider,
  useEditor,
  useEditorDispatch,
  useEditorSelector,
} from './editor-store'

function LegacyConsumer() {
  const renders = useRef(0)
  renders.current += 1
  const { dispatch } = useEditor()
  return (
    <div>
      <span data-testid="legacy-count">{renders.current}</span>
      <button
        type="button"
        data-testid="legacy-zoom"
        onClick={() => dispatch({ type: 'EDITOR_SET_ZOOM', zoom: 2 })}
      />
    </div>
  )
}

function SelectionConsumer() {
  const renders = useRef(0)
  renders.current += 1
  const entityId = useEditorSelector((s) => s.selection.entityId)
  return <span data-testid="selection">{`${renders.current}:${entityId ?? 'none'}`}</span>
}

function DispatchOnlyConsumer() {
  const renders = useRef(0)
  renders.current += 1
  useEditorDispatch()
  return <span data-testid="dispatch-only">{renders.current}</span>
}

describe('useEditorSelector / useEditorDispatch', () => {
  afterEach(() => {
    cleanup()
  })

  it('useEditorSelector skips re-render when an unrelated slice changes', () => {
    const { getByTestId } = render(
      <EditorProvider>
        <SelectionConsumer />
        <LegacyConsumer />
      </EditorProvider>,
    )

    expect(getByTestId('selection').textContent).toBe('1:none')

    act(() => {
      getByTestId('legacy-zoom').click()
    })

    expect(getByTestId('selection').textContent).toBe('1:none')
    expect(Number(getByTestId('legacy-count').textContent)).toBeGreaterThan(1)
  })

  it('useEditorDispatch does not re-render on core state changes', () => {
    const { getByTestId } = render(
      <EditorProvider>
        <DispatchOnlyConsumer />
        <LegacyConsumer />
      </EditorProvider>,
    )

    expect(getByTestId('dispatch-only').textContent).toBe('1')

    act(() => {
      getByTestId('legacy-zoom').click()
    })

    expect(getByTestId('dispatch-only').textContent).toBe('1')
  })

  it('legacy useEditor still re-renders on core state changes', () => {
    const { getByTestId } = render(
      <EditorProvider>
        <LegacyConsumer />
      </EditorProvider>,
    )

    expect(getByTestId('legacy-count').textContent).toBe('1')

    act(() => {
      getByTestId('legacy-zoom').click()
    })

    expect(Number(getByTestId('legacy-count').textContent)).toBeGreaterThan(1)
  })
})
