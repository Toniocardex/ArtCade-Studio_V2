# ArtCade Studio — Product Maturity

Professional contract status for release blockers. Each item is **Not started**, **Partial**, or **Release-ready** with verifiable acceptance criteria.

## Project Safety

| Item | State | Definition of Done |
|------|-------|-------------------|
| Project format version + validator | Partial | `projectFormatVersion`, `projectId`, `engineVersion` on save; `loadProjectDocument()` with distinct errors |
| Atomic safe-save + backup | Partial | `.bak` rotation on save; recovery prompt on open |
| Migration chain | Partial | Explicit `migrateVnToVm` + fixtures v0–v3 |
| Recovery at startup | Partial | User chooses recovery / saved / discard on open |

## Authoring Integrity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Universal undo/redo | Partial | Core reducers exist; not all authoring paths transactional |
| Validation before save/play | Partial | `validateProjectBeforeSave` + serialized round-trip |

## Asset Identity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Stable asset IDs | Partial | Save rewrites path refs to library ids; validator blocks path aliases |
| Rename/move without broken refs | Partial | Path security skips stable ids; tileset paths still file-relative |

## Runtime Parity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Frame / presentation commit | Release-ready | `SceneFrameSnapshot` + `beginFrame()` single path |
| Scene lifecycle | Release-ready | `reactivate` ≠ `restart`; `restoreSceneFromAuthoring` |
| Edit / Play / WASM parity | Partial | Golden projects not yet in CI |

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
| Golden project `platformer-basic` | Partial | `examples/platformer-basic/project.json` + load/validate test |

## Tests / Gates

| Gate | State |
|------|-------|
| Local verify (`npm test`, C++ ctest, WASM, desktop) | Partial — manual / `npm run verify` |
| Editor unit tests (1200+) | Release-ready |
| Scene/lifecycle C++ tests | Release-ready |

## Current release blockers (ordered)

1. Project boot sync confirmed (runtime loads scene before JS latch)
2. Project save backup + recovery UX
3. Migration chain with fixtures
4. Stable asset ID contract end-to-end
5. Export preflight for Windows + HTML5
6. Golden project in CI
