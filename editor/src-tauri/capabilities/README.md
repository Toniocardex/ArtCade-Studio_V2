# Tauri capabilities

**Edit only** [`default.json`](default.json) — never hand-edit files under `../gen/schemas/`.

After changing permissions, regenerate the bundled ACL snapshot:

```powershell
cd editor
npm run tauri:sync-schemas
```

Then commit `default.json` and, if `gen/schemas/capabilities.json` changed, that file too.

`fs:scope-home-recursive` and `fs:scope-desktop-recursive` are required so projects under Desktop / user profile paths work with the fs plugin (Open/Save, build, pack).

**Security model:** the wide FS scopes allow the plugin to read user-chosen paths; **writes** to project files go through Rust commands (`write_file`, `write_binary_file`) with `validate_writable_path` / `resolve_path_under_project_root` in `src-tauri/src/main.rs`. Narrowing scopes to “project root only” is not supported by the fs plugin alone without breaking Desktop/Home project locations — do not remove these permissions without a replacement path API.
