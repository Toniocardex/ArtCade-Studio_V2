# ArtCade MVP Release Gate

> Source: product release threshold notes, consolidated 2026-06-24.
> Purpose: define the minimum public-alpha bar for ArtCade as a complete
> vertical slice, not as a feature-count contest.

## Release Principle

ArtCade is ready for a public alpha when an external tester can create a small
game without modifying the engine and without manual repair of broken project
files, asset references, Lua output, or exports.

The first release should prove that Canvas, Object Model, Logic Board, Lua,
runtime preview, save/reopen, and export behave as one predictable workflow.

Recommended public version label: `0.1.0-alpha`.

## Concrete Acceptance Scenario

A tester must be able to build a project containing:

- start menu
- at least two scenes
- controllable character
- collisions
- animations
- enemy or obstacle
- collectible object
- score variable
- audio
- HUD
- game over or victory screen
- saved project
- closed and reopened project
- exported build that runs outside ArtCade

The project must survive this cycle:

```text
Create -> Edit -> Save -> Close -> Reopen -> Play -> Fix -> Export -> Run outside ArtCade
```

No data loss, invisible broken references, or hand-edited engine files are
allowed in that cycle.

## P0 - Blocks Public Release

### 1. Project System

- Create new project.
- Open existing project.
- Save and Save As.
- Deterministic project folder layout.
- Project format version.
- Clear migration or incompatibility messages.
- Missing-file detection.
- Recovery from interrupted save or crash.
- Atomic save: write temp file, validate, replace original.
- Internal references use immutable IDs, not display names or filenames.
- Every resource has immutable ID, editable display name, and project-relative path.

Suggested project layout:

```text
MyGame/
  artcade.project
  scenes/
  objects/
  prefabs/
  logic/
  scripts/
  assets/
    images/
    audio/
    fonts/
  settings/
```

### 2. Scene And Canvas

- Create, rename, duplicate, and delete scenes.
- Set startup scene.
- Add objects to the Canvas.
- Reliable selection, including overlapping objects.
- Multi-select.
- Move, scale, and rotate.
- Duplicate, copy, paste, and delete.
- Undo and redo.
- Snap to grid.
- Zoom and pan.
- Layer ordering.
- Editable z-order.
- Numeric coordinate editing.
- Selected-object highlight.
- Coherent handling of objects outside the viewport.
- Exact scene save/reopen.
- Inspector property editing.

Without reliable undo/redo and selection, the editor is not public-release
ready.

### 3. Asset Manager

- Import PNG.
- Import JPG if supported by the runtime path.
- Import spritesheets.
- Import WAV and OGG.
- Import Raylib-compatible fonts.
- Preview assets.
- Rename assets.
- Move assets in virtual folders.
- Delete only after reference detection.
- Drag and drop.
- Refresh externally modified assets.
- Explain missing or corrupted assets.
- Avoid absolute user-machine paths.
- Avoid accidental duplicate assets.
- Avoid ambiguous names.
- Avoid deletions that leave hidden broken references.

### 4. Object And Prefab System

- Clear distinction between Object Definition, Object Instance, and Prefab.
- Create Object Definitions.
- Assign texture.
- Add components.
- Create scene instances.
- Override instance-specific properties.
- Duplicate objects.
- Create and instantiate prefabs.
- Update references correctly.
- Prevent duplicate names in the same namespace.
- Enforce duplicate-name rules on create, rename, duplicate, and import.
- Use case-insensitive checks when the target filesystem requires them.
- Show explicit messages, for example:

```text
A prefab named "Player" already exists.
Choose a different name.
```

Do not silently resolve duplicates with unpredictable names.

### 5. Essential Runtime Components

- Transform: position, rotation, scale, origin/pivot.
- Sprite Renderer: texture, source rectangle, tint, flip X/Y, visibility,
  layer/order.
- Sprite Animator: clips, frame duration, loop, play, pause, stop, current
  animation.
- Collision: rectangle collider, circle collider, trigger/non-trigger,
  layer/mask, enter/stay/exit, overlap query.
- Movement: position/velocity, kinematic movement, optional gravity, basic
  collision, reliable platformer movement or example controller.
- Camera: position, zoom, follow, bounds, world/screen conversion, active
  scene camera.
- Audio: sound effects, music, master volume, music volume, SFX volume, loop,
  stop, pause.
- Text: render text, font, size, color, basic alignment.

Text is required for score, tutorials, menus, and end screens.

### 6. Layer System

- Create and remove layers.
- Rename layers.
- Reorder layers.
- Visibility.
- Editor lock.
- Opacity.
- Object assignment to layer.
- World-space layers.
- At least one screen-space layer for HUD/UI.

Parallax is optional for the first alpha. If present, it must support factor X,
factor Y, Canvas preview, serialization, and correct culling.

### 7. Logic Board

The Logic Board is ArtCade's differentiator and must be real, not a partial
demo.

Minimum triggers:

- System: On game start, On scene start, Every tick, Every N seconds.
- Input: key pressed, key released, key held, mouse button pressed, mouse
  button released.
- Object: on created, on destroyed, collision enter/exit, trigger enter/exit.
- Animation: on animation finished.

Minimum conditions:

- value compare
- boolean true/false
- object exists
- object visible
- input held
- collision with class or object
- variable equal/greater/less

Minimum actions:

- change position
- change velocity
- show/hide
- create object
- destroy object
- change scene
- play animation
- play audio
- set variable
- increment/decrement variable
- wait or create timer
- print to log

Technical requirements:

- deterministic Lua generation
- validation before compile
- errors linked to the responsible rule
- stable saved IDs
- no unnecessary duplicate generated code
- correct subscription lifecycle
- isolated per-rule state
- versioned API
- fast enough compile
- no crash on missing references
- useful empty states that guide the user to create required data

### 8. Variables

- Scopes: Global, Scene, Object instance.
- Types: number, boolean, string.
- Operations: create, read, set, add/subtract, compare, reset.
- Accessible from both Lua and Logic Board.

Runtime variables are P0. Persistent save/load variables can come later.

### 9. Scene Management

- Set startup scene.
- Load scene.
- Change scene.
- Reload scene.
- Optional global-variable persistence across scenes.
- Safe cleanup of previous scene objects.
- Deterministic initialization of new scene.

Immediate transitions are enough for MVP.

### 10. UI And HUD

- Text.
- Image.
- Button.
- Basic anchors.
- Screen-space rendering.
- Click events.
- Show/hide.
- Text update.

This is required for a start menu, game over screen, score, tutorial, and
restart button.

### 11. Lua Scripting

- Create Lua files.
- Edit Lua files.
- Save Lua files.
- Syntax highlighting.
- Line numbers.
- Errors with file and line.
- Documented API.
- Attach script to objects or scenes.
- Clear lifecycle.
- Logic Board and Lua share the same runtime model.

Minimum lifecycle can be:

```lua
function onCreate(self)
end

function onUpdate(self, dt)
end

function onDestroy(self)
end
```

An equivalent lifecycle is acceptable if it is consistent with the engine.

### 12. Play Mode And Debugging

- Play.
- Stop.
- Pause.
- Restart scene.
- Clear editor/play state indicator.
- Runtime state separated from saved scene state.
- Scene restored after test.
- Console log/warn/error.
- Script or rule name in diagnostics.
- Stack or minimal context.
- Optional timestamp.
- Clear console.
- Useful Focus Source action that jumps to Logic Board node or Lua line.

### 13. Export

Pick one primary target for MVP. Current recommended target: Windows x64.

- Choose output folder.
- Debug or release build.
- Copy required assets.
- Runnable executable outside the editor.
- No absolute paths.
- Optional icon.
- Game name.
- Version.
- Initial resolution.
- Fullscreen/windowed setting.
- Understandable build log.

One reliable Windows export is better than multiple unstable targets.

### 14. Project Settings

- Project name.
- Project ID.
- Version.
- Startup scene.
- Window width and height.
- Resizable.
- Fullscreen.
- VSync.
- Target FPS.
- Pixel-perfect mode.
- Default background color.
- Basic input actions: MoveLeft, MoveRight, Jump, Confirm.

A small Input Map is preferred over rules tied only to physical keys, though
both can be supported in alpha.

### 15. Error Handling

Errors must explain:

- what happened
- where it happened
- how to fix it

Cases to cover:

- missing texture
- no startup scene
- ID not found
- invalid prefab
- duplicate name
- Lua compile error
- incomplete Logic Board rule
- action with missing parameter
- corrupted scene
- unsupported asset
- unwritable export folder
- missing build toolchain
- incompatible project version

Example:

```text
Cannot export the project.

No startup scene is configured.
Open Project Settings and select a startup scene.
```

### 16. Data Integrity

Destructive operations need tests:

- object delete
- asset delete
- prefab delete
- rename
- move
- duplicate
- undo/redo
- save during complex edits
- close with unsaved changes
- crash during save
- open older project

### 17. Minimum Safety

- Validate paths.
- Block path traversal.
- Warn before opening untrusted projects with Lua scripts.
- Separate temporary files.
- Validate JSON.
- Do not trust loaded IDs blindly.
- Avoid name collisions.
- Do not include external files accidentally in export.
- Keep secrets out of the repo.
- Use controlled dependency versions.

Suggested warning:

```text
This project contains Lua scripts.
Open only projects from sources you trust.
```

### 18. External-User UX

- Welcome screen.
- New Project.
- Empty template.
- At least one readable platformer or top-down template.
- Essential tooltips.
- Empty states.
- Confirmation for destructive actions.
- Visible shortcuts.
- Documentation reachable from editor.
- Example project.

Templates must be simple and readable.

### 19. Required Documentation

- install
- first project
- asset import
- create object
- Canvas
- layers
- animations
- collisions
- Logic Board
- variables
- scene switching
- audio
- export
- basic Lua API
- known issues

Main tutorial target:

1. Create a project.
2. Import Player and Ground.
3. Create Object Definitions.
4. Add colliders.
5. Add movement and jump.
6. Create a coin.
7. Handle collision.
8. Show score.
9. Create an end screen.
10. Export the game.

### 20. Release Management

- Visible version.
- Changelog.
- License.
- Privacy policy only if data is collected.
- Log folder.
- Bug report process.
- System requirements.
- Known issues.
- Reproducible build.
- Installer or portable archive.

## P1 - Strongly Recommended

- Autosave.
- Templates.
- Input Map.
- Basic backdrop/parallax.
- Basic tilemap.
- Camera follow and bounds.
- Game save/load.
- Installer packaging.
- Project migrations.

## P2 - Post-Release

- visual shader editor
- advanced particle editor
- procedural tilemaps
- full pathfinding
- networking
- multiplayer
- user-exposed ECS
- material editor
- mobile console
- plugin marketplace
- cloud collaboration
- full localization
- cinematic timeline
- advanced dialog system
- complex post-processing
- advanced physics joints
- all-platform export
- universal hot reload
- graphical profiler
- AI behavior trees
- complex nested prefabs
- additive scenes
- advanced parallax with multiple cameras

## Non-Goal For First Public Alpha

The public alpha does not need to impress through feature count. It needs to
prove that the central authoring loop is coherent, predictable, and usable by
someone who did not build the engine.

