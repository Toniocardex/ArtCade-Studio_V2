import type { LogicAction, LogicCondition, LogicTriggerType } from '../../types/logic-board'

/** Sentinel for add-rule trigger picker before the user chooses a type. */
export const NEW_TRIGGER_NONE = '' as const
export type NewTriggerPick = LogicTriggerType | typeof NEW_TRIGGER_NONE

/** Sentinel for Then-row action picker before the user chooses a type. */
export const NEW_ACTION_NONE = '' as const
export type NewActionPick = LogicAction['type'] | typeof NEW_ACTION_NONE

/** Sentinel for Also require… condition picker before the user chooses a type. */
export const NEW_CONDITION_NONE = '' as const
export type NewConditionPick = LogicCondition['type'] | typeof NEW_CONDITION_NONE
