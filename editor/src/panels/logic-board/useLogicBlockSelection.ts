import { useCallback, useEffect, useState } from 'react'

export type LogicBlockSelection =
  | { kind: 'trigger' }
  | { kind: 'condition'; index: number }
  | { kind: 'conditionTree' }
  | { kind: 'action'; index: number }
  | null

export function useLogicBlockSelection(focusedEventId: string | null) {
  const [selection, setSelection] = useState<LogicBlockSelection>({ kind: 'trigger' })

  useEffect(() => {
    setSelection({ kind: 'trigger' })
  }, [focusedEventId])

  const selectTrigger = useCallback(() => setSelection({ kind: 'trigger' }), [])
  const selectCondition = useCallback((index: number) => {
    setSelection({ kind: 'condition', index })
  }, [])
  const selectConditionTree = useCallback(() => setSelection({ kind: 'conditionTree' }), [])
  const selectAction = useCallback((index: number) => {
    setSelection({ kind: 'action', index })
  }, [])

  const isSelected = useCallback(
    (block: LogicBlockSelection): boolean => {
      if (!selection || !block) return false
      if (selection.kind !== block.kind) return false
      if (selection.kind === 'trigger' || selection.kind === 'conditionTree') return true
      if (block.kind === 'condition' && selection.kind === 'condition') {
        return selection.index === block.index
      }
      if (block.kind === 'action' && selection.kind === 'action') {
        return selection.index === block.index
      }
      return false
    },
    [selection],
  )

  return {
    selection,
    setSelection,
    selectTrigger,
    selectCondition,
    selectConditionTree,
    selectAction,
    isSelected,
  }
}
