/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect, afterEach } from 'vitest'
import { render, act, cleanup } from '@testing-library/react'
import { useEffect } from 'react'
import { EditorProvider, useEditorDispatch } from '../../store/editor-store'
import { VariableKeyPicker } from './VariableKeyPicker'
import { createBlankProject } from '../../utils/project-factory'
import type { GameVariableDefinition } from '../../types'

function LoadGlobals({ variables }: { variables: GameVariableDefinition[] }) {
  const dispatch = useEditorDispatch()
  useEffect(() => {
    const project = createBlankProject('Test')
    project.globalVariables = variables
    dispatch({ type: 'LOAD_PROJECT', path: '', project })
  }, [dispatch, variables])
  return null
}

describe('VariableKeyPicker', () => {
  afterEach(() => cleanup())

  it('does not recurse when global options are mapped each snapshot', () => {
    expect(() => {
      render(
        <EditorProvider>
          <LoadGlobals variables={[{ key: 'score', type: 'number', initialValue: 0 }]} />
          <VariableKeyPicker scope="global" value="score" onChange={() => {}} />
        </EditorProvider>,
      )
      act(() => {})
    }).not.toThrow()
  })
})
