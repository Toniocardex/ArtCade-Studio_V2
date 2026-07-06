/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, act, fireEvent } from '@testing-library/react'
import EditorBootGate from './EditorBootGate'
import { SPLASH_INTRO_HOLD_MS, SPLASH_MIN_VISIBLE_MS, SPLASH_SKIP_INTRO_COMPLETE_MS } from './splash-choreography'

const revealForSplash = vi.fn()
const warmWasmBinary = vi.fn()

vi.mock('../utils/boot-chrome', () => ({
  revealTauriWindowForSplash: (...args: unknown[]) => revealForSplash(...args),
}))

vi.mock('../utils/wasm-bridge', () => ({
  warmWasmBinary: (...args: unknown[]) => warmWasmBinary(...args),
}))

vi.mock('./BootRuntimeLoader', () => ({
  default: () => null,
}))

const useEditorBootReadyMock = vi.fn()

vi.mock('../hooks/useEditorBootReady', () => ({
  useEditorBootReady: () => useEditorBootReadyMock(),
}))

function mockBootReady(overrides: Partial<{
  ready: boolean
  timedOut: boolean
  statusLine: string
}> = {}) {
  useEditorBootReadyMock.mockReturnValue({
    ready: false,
    timedOut: false,
    statusLine: 'Loading runtime…',
    diagnosticHints: [],
    retry: vi.fn(),
    ...overrides,
  })
}

function overlayEl(): HTMLElement {
  const el = document.querySelector('.boot-overlay')
  if (!el) throw new Error('boot overlay missing')
  return el as HTMLElement
}

describe('EditorBootGate splash pipeline', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    revealForSplash.mockClear()
    warmWasmBinary.mockClear()
    document.body.innerHTML = '<div id="boot-shell">ArtCade Studio</div><div id="root"></div>'
    mockBootReady()
  })

  afterEach(() => {
    vi.useRealTimers()
    document.body.innerHTML = ''
  })

  it('reveals the Tauri window when the splash mounts, not when fading', () => {
    render(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    expect(revealForSplash).toHaveBeenCalledTimes(1)
    expect(document.getElementById('boot-shell')).toBeNull()
    expect(overlayEl().className).not.toContain('boot-overlay--fading')
  })

  it('full path: intro completes → engine ready → fade after minimum visible time', () => {
    const started = Date.now()
    vi.setSystemTime(started)

    const readyRef = { current: false }
    mockBootReady({ ready: readyRef.current })

    const view = render(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    act(() => { vi.advanceTimersByTime(SPLASH_INTRO_HOLD_MS) })
    expect(overlayEl().className).not.toContain('boot-overlay--fading')

    readyRef.current = true
    mockBootReady({ ready: true })
    view.rerender(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    act(() => { vi.advanceTimersByTime(SPLASH_MIN_VISIBLE_MS - SPLASH_INTRO_HOLD_MS) })

    expect(overlayEl().className).toContain('boot-overlay--fading')
    expect(revealForSplash).toHaveBeenCalledTimes(1)
  })

  it('skip is disabled until engine ready', () => {
    mockBootReady({ ready: false })

    render(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    const skipBtn = screen.getByRole('button', { name: /skip intro/i }) as HTMLButtonElement
    expect(skipBtn.disabled).toBe(true)
    fireEvent.click(skipBtn)
    expect(overlayEl().className).not.toContain('boot-overlay--fading')
  })

  it('skip path: engine ready → skip → fade after minimum visible time', () => {
    const started = Date.now()
    vi.setSystemTime(started)

    const view = render(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    mockBootReady({ ready: true })
    view.rerender(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    const skipBtn = screen.getByRole('button', { name: /skip intro/i }) as HTMLButtonElement
    expect(skipBtn.disabled).toBe(false)
    fireEvent.click(skipBtn)

    act(() => { vi.advanceTimersByTime(SPLASH_SKIP_INTRO_COMPLETE_MS) })
    expect(screen.queryByText('Loading runtime…')).toBeNull()
    expect(overlayEl().className).not.toContain('boot-overlay--fading')

    act(() => { vi.advanceTimersByTime(SPLASH_MIN_VISIBLE_MS) })

    expect(overlayEl().className).toContain('boot-overlay--fading')
    expect(skipBtn.disabled).toBe(true)
  })

  it('does not fade before intro completes even if engine is ready', () => {
    mockBootReady({ ready: true })

    render(
      <EditorBootGate>
        <div>editor</div>
      </EditorBootGate>,
    )

    act(() => { vi.advanceTimersByTime(SPLASH_INTRO_HOLD_MS - 1) })
    expect(overlayEl().className).not.toContain('boot-overlay--fading')
  })
})
