# Deferred UI items (post–2026 refactor)

Tracked separately from the main UI integration plan. These require runtime contracts, schema migrations, or large catalog work.

| Item | Blocker |
|------|---------|
| Execution Trace (live) | No runtime event feed in editor store |
| Variable Watch (live) | Needs WASM debug protocol |
| Logic event metadata (name, group, comment, run while paused) | Breaking `.artcade` + compiler |
| Full Trigger/Condition/Action catalogs (spec §8–10) | New JSON schemas + C++ API |
| Persisted layout presets | Nice-to-have |
| Native animation timeline in bottom dock | Spritesheet ↔ scene integration |

See `LOGIC_BOARD_UI_SPEC.md` for the target UX once unblocked.
