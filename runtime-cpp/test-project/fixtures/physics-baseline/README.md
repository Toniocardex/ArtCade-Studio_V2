# Physics baseline fixtures (Fase 0)

Reference entity snapshots for manual smoke of
[`docs/PHYSICS_OPTIONAL_INTEGRATION_PLAN.md`](../../../docs/PHYSICS_OPTIONAL_INTEGRATION_PLAN.md)
§7 Fase 0. Copy fragments into `test-project/project.json` (or a scratch project)
to compare behavior before Fase 1 (kinematic platformer).

| File | Player setup | Expected on `main` today |
|------|----------------|-------------------------|
| `player-with-explicit-physics.json` | `platformerController` + explicit `physics` collider | Box2D body; movement/jump via `setLinearVelocity` |
| `player-platformer-only.json` | `platformerController` only (no `physics` block in JSON) | Kinematic transform (Fase 1); fall/jump via `customGravity`; add Solid for grounded |

Ground/platform: add a `Solid` or static `physics` entity with `groundClass` matching the player.

## Manual checklist (§11)

- [ ] `player-platformer-only`: preview — player falls with gravity; no Box2D body on player until Physics added.
- [ ] With Solid ground: overlap grounded when player has explicit Physics collider (Fase 2 improves kinematic-only grounded).
