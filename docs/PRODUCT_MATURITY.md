# ArtCade Studio — Product Maturity

Professional contract status for release blockers. Each item is **Not started**, **Partial**, or **Release-ready** with verifiable acceptance criteria.

## Project Safety

| Item | State | Definition of Done |
|------|-------|-------------------|
| Project format version + validator | Partial | `projectFormatVersion`, `projectId`, `engineVersion` on save; `loadProjectDocument()` with distinct errors |
| Atomic safe-save + backup | Partial | Rust `write_atomic` in use; `.bak` rotation + user-facing recovery UI not done |
| Migration chain | Not started | Explicit `migrateVnToVm` + fixtures per version |
| Recovery at startup | Not started | User chooses among `.json`, `.tmp`, `.bak` |

## Authoring Integrity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Universal undo/redo | Partial | Core reducers exist; not all authoring paths transactional |
| Validation before save/play | Partial | `validateProjectBeforeSave` + serialized round-trip |

## Asset Identity

| Item | State | Definition of Done |
|------|-------|-------------------|
| Stable asset IDs | Partial | Image assets have `id`; path-only references still exist in places |
| Rename/move without broken refs | Partial | Project-relative paths validated; full ID indirection pending |

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
| Golden project `platformer-basic` | Not started | Vertical slice + CI smoke |

## Tests / Gates

| Gate | State |
|------|-------|
| `smoke-main` (editor + C++ + WASM + desktop) | Partial — pinned Emscripten 5.0.7 |
| Editor unit tests (1200+) | Release-ready |
| Scene/lifecycle C++ tests | Release-ready |

## Current release blockers (ordered)

1. `smoke-main` green on GitHub Actions
2. Project save backup + recovery UX
3. Migration chain with fixtures
4. Stable asset ID contract end-to-end
5. Export preflight for Windows + HTML5
6. Golden project in CI
