# Physics baseline fixtures (Fase 0)

Reference entity snapshots for manual smoke of
[`docs/PHYSICS_OPTIONAL_INTEGRATION_PLAN.md`](../../../docs/PHYSICS_OPTIONAL_INTEGRATION_PLAN.md)
§7 Fase 0. Copy fragments into `test-project/project.json` (or a scratch project)
to compare behavior before Fase 1 (kinematic platformer).

| File | Player setup | Expected on `main` today |
|------|----------------|-------------------------|
| `player-with-explicit-physics.json` | `platformerController` + explicit `physics` collider | Box2D body; movement/jump via `setLinearVelocity` |
| `player-platformer-only.json` | `platformerController` only (no `physics` block in JSON) | Implicit dynamic body from `ensurePhysicsBody`; same as above |

Ground/platform: add a `Solid` or static `physics` entity with `groundClass` matching the player.

## Manual checklist (§11)

- [ ] `player-platformer-only`: preview shows body created (overlap grounded possible with solid ground).
- [ ] After Fase 1: same fixture should move/jump without explicit player `physics` block.
