# ArtCade Studio — Product Maturity

Professional contract status for release blockers. Each item is **Not started**, **Partial**, or **Release-ready** with verifiable acceptance criteria.

## Project Safety

| Item | State | Definition of Done |
|------|-------|-------------------|
| Project format version + validator | Release-ready | `projectFormatVersion`, `projectId`, `engineVersion` on save; `loadProjectDocument()` with distinct errors |
| Atomic safe-save + backup | Release-ready | `.bak` rotation on save; recovery prompt on open |
| Migration chain | Release-ready | Explicit `migrateVnToVm` + fixtures v0–v4 |
| Recovery at startup | Release-ready | User chooses recovery / saved / discard on open; backup offered when `project.json` is unreadable |

## Authoring Integrity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Universal undo/redo | Partial | Core reducers exist; not all authoring paths transactional |
| Validation before save/play | Release-ready | `prepareSerializedProjectDocument` on save/scaffold; play uses `collectSaveValidationErrors` |

## Asset Identity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Stable asset IDs | Release-ready | Save rewrites sprite/audio path refs to library ids; validator blocks path aliases |
| Rename/move without broken refs | Release-ready | Display-name rename by stable id; path security skips library ids; tileset sheets stay path-keyed in library rows |

## Runtime Parity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Frame / presentation commit | Release-ready | `SceneFrameSnapshot` + `beginFrame()` single path |
| Scene lifecycle | Release-ready | `reactivate` ≠ `restart`; `restoreSceneFromAuthoring` |
| Edit / Play / WASM parity | Partial | Golden project has local smoke gate (`npm run test:project-safety`) |

## Export Reliability

| Item | State | Definition of Done |
|------|-------|-------------------|
| Windows + HTML5 export | Partial | Builds work locally; preflight gate not implemented |
| Export preflight | Not started | Blocked vs warnings before pack |

## Debuggability

| Item | State | Definition of Done |
|------|-------|-------------------|
| Logic Board trace / breakpoints | Not started | Rule-level step + condition evaluation visible |
| Integrated profiler | Not started | Frame budget by subsystem |

## Complete Game Workflows

| Item | State | Definition of Done |
|------|-------|-------------------|
| UI runtime (menu/HUD) | Not started | Canvas UI distinct from editor chrome |
| Input actions | Not started | Action map, not raw key codes in Logic Board |
| Golden project `platformer-basic` | Release-ready | `examples/platformer-basic/` tree + load/validate/round-trip/fingerprint tests |

## Tests / Gates

| Gate | State |
|------|-------|
| Local verify (`npm run verify`) | Release-ready — runs `test:project-safety` then full editor tests + builds |
| Editor unit tests (1200+) | Release-ready |
| Scene/lifecycle C++ tests | Release-ready |

## Current release blockers (ordered)

1. Export preflight for Windows + HTML5
2. Universal undo/redo across all authoring paths
3. UI runtime + input actions for complete game workflows
