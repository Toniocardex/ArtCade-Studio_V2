# UI refactor — fix plan (priority order)

Applied after full audit (2026). Each step depends on the previous where noted.

## P0 — Correctness blockers

| Step | Item | Files |
|------|------|--------|
| 0.1 | Extract `NEW_TRIGGER_NONE`, `NewTriggerPick`, `NewActionPick` | `picker-constants.ts` |
| 0.2 | Fix Rules of Hooks: `DialogIdField` component | `SchemaParamForm.tsx` |
| 0.3 | Delete dead modules | `LogicBoardEventsList.tsx`, `EventCard.tsx`, `ConsoleDock.tsx` |
| 0.4 | Update all imports to `picker-constants.ts` | Panel, sidebar, `EventEditor` |

## P1 — Inspector / selection architecture

| Step | Item | Files |
|------|------|--------|
| 1.1 | `useLogicBlockSelection()` — shared state + patch helpers | `useLogicBlockSelection.ts` |
| 1.2 | `LogicBoardVisualLayout` owns hook; passes to center + right | `LogicBoardVisualLayout.tsx` |
| 1.3 | `EventEditor` — `inspectorMode` hides center params (onInput, conditions, actions) | `EventEditor.tsx` |
| 1.4 | `LogicInspectorPanel` — trigger / flat condition / action + `ConditionTreeEditor` for `conditionRoot` | `LogicInspectorPanel.tsx` |
| 1.5 | Wire `onBlockSelect` on condition rows | `EventEditor.tsx` |

## P2 — Regressions & plan gaps

| Step | Item | Files |
|------|------|--------|
| 2.1 | Fix `eventTriggerSummaryPlain(ev, project)` | `LogicBoardPreviewTab.tsx` |
| 2.2 | Sidebar: enable toggle, clone, delete, move; optional multi-board section | `LogicEventsSidebar.tsx` |
| 2.3 | Assets explorer → `openDialogEditorForId` for dialog scripts | `ProjectExplorerPanel.tsx` |
| 2.4 | Remove noop “Save rule” in workspace mode | `EventEditor.tsx` |

## P3 — Polish & tests

| Step | Item | Files |
|------|------|--------|
| 3.1 | `DIALOG_OPEN_MODAL` store trimmed `dialogId` | `dialog-reducer.ts` |
| 3.2 | `HierarchicalBlockPicker` reset selection when `types` change | `HierarchicalBlockPicker.tsx` |
| 3.3 | DOM test: picker + map unit test kept | `*.test.ts(x)` |
| 3.4 | `npm test -- --run` | — |

## Out of scope (separate PR)

- Tauri icon / `InspectorClipPreview` asset churn
- Full Tools menu “Dialog library” (View menu sufficient)
- Visual event grouping (Movement / Combat)
