// @vitest-environment happy-dom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { completeChoicePrompt, resetChoicePromptForTests } from './choice-prompt'
import {
  hasUnsavedAuthoring,
  resolveUnsavedGuard,
} from './unsaved-guard'
import type { CoreState } from '../store/editor-store-state'
import { initialCoreState } from '../store/editor-store-state'
import { createBlankProject } from './project'

afterEach(() => {
  resetChoicePromptForTests()
})

describe('hasUnsavedAuthoring', () => {
  it('is true when projectDirty', () => {
    expect(hasUnsavedAuthoring({ projectDirty: true, openScripts: [] })).toBe(true)
  })

  it('is true when a script buffer is dirty', () => {
    expect(hasUnsavedAuthoring({
      projectDirty: false,
      openScripts: [{ path: 'scripts/a.lua', content: 'x', isDirty: true }],
    })).toBe(true)
  })

  it('is false when clean', () => {
    expect(hasUnsavedAuthoring({
      projectDirty: false,
      openScripts: [{ path: 'scripts/a.lua', content: 'x', isDirty: false }],
    })).toBe(false)
  })
})

describe('resolveUnsavedGuard', () => {
  it('proceeds without prompt when clean', async () => {
    const dispatch = vi.fn()
    const ok = await resolveUnsavedGuard({
      state: {
        ...initialCoreState,
        project: createBlankProject('T'),
        projectDirty: false,
        openScripts: [],
      } as CoreState,
      actionLabel: 'test',
      dispatch,
      flushBeforePersist: () => null,
    })
    expect(ok).toBe(true)
  })

  it('cancels when the user picks Cancel', async () => {
    const dispatch = vi.fn()
    const pending = resolveUnsavedGuard({
      state: {
        ...initialCoreState,
        project: createBlankProject('T'),
        projectDirty: true,
        openScripts: [],
      } as CoreState,
      actionLabel: 'Opening another project.',
      dispatch,
      flushBeforePersist: () => createBlankProject('T'),
    })
    queueMicrotask(() => completeChoicePrompt('cancel'))
    await expect(pending).resolves.toBe(false)
  })

  it('allows discard without saving', async () => {
    const dispatch = vi.fn()
    const pending = resolveUnsavedGuard({
      state: {
        ...initialCoreState,
        project: createBlankProject('T'),
        projectDirty: true,
        openScripts: [],
      } as CoreState,
      actionLabel: 'Creating a new project.',
      dispatch,
      flushBeforePersist: () => createBlankProject('T'),
    })
    queueMicrotask(() => completeChoicePrompt('discard'))
    await expect(pending).resolves.toBe(true)
  })
})
