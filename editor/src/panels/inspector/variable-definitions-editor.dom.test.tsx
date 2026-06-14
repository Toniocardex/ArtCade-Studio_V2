/**
 * @vitest-environment happy-dom
 */
import { describe, it, expect } from 'vitest'
import { render, fireEvent } from '@testing-library/react'
import { useState } from 'react'
import { VariableDefinitionsEditor } from './VariableDefinitionsEditor'
import type { GameVariableDefinition } from '../../types'

function Harness({ initial }: { initial: GameVariableDefinition[] }) {
  const [variables, setVariables] = useState(initial)
  return <VariableDefinitionsEditor variables={variables} onChange={setVariables} />
}

describe('VariableDefinitionsEditor', () => {
  it('keeps focus on the key field while renaming', () => {
    const { getByLabelText } = render(
      <Harness initial={[{ key: 'variable_1', type: 'number', initialValue: 0 }]} />,
    )
    const keyInput = getByLabelText('Variable key') as HTMLInputElement
    keyInput.focus()
    expect(document.activeElement).toBe(keyInput)

    fireEvent.change(keyInput, { target: { value: 's' } })
    expect(document.activeElement).toBe(keyInput)

    fireEvent.change(keyInput, { target: { value: 'sc' } })
    expect(document.activeElement).toBe(keyInput)

    fireEvent.change(keyInput, { target: { value: 'score' } })
    expect(document.activeElement).toBe(keyInput)
    expect(keyInput.value).toBe('score')
  })
})
