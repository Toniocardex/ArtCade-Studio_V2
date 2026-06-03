# Tauri capabilities

**Edit only** [`default.json`](default.json) — never hand-edit files under `../gen/schemas/`.

After changing permissions, regenerate the bundled ACL snapshot:

```powershell
cd editor
npm run tauri:sync-schemas
```

Then commit `default.json` and, if `gen/schemas/capabilities.json` changed, that file too.

**FS scope model:** project reads/writes for user-chosen locations use `document` / `desktop` / `download` recursive scopes plus `$HOME/**` with explicit **deny** rules for `.ssh` and `AppData`. This replaces blanket `fs:scope-home-recursive` while still allowing projects under the user profile (e.g. `~/source/repos`).

**Security model:** validated writes to project files go through Rust commands (`write_file`, `write_binary_file`) with `validate_writable_path` / `is_allowed_project_relative` in `src-tauri/src/main.rs`.
