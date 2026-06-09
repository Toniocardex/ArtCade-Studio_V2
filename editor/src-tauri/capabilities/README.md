# Tauri capabilities

**Edit only** [`default.json`](default.json) — never hand-edit files under `../gen/schemas/`.

After changing permissions, regenerate the bundled ACL snapshot:

```powershell
cd editor
npm run tauri:sync-schemas
```

Then commit `default.json` and, if `gen/schemas/capabilities.json` changed, that file too.

**FS scope model:** static scopes cover `document` / `desktop` / `download`. Projects elsewhere register their folder at load time via the `register_project_fs_scope` Tauri command (called from `runLoadProjectSideEffects` on `LOAD_PROJECT`). Validated writes to project files still go through Rust `write_file` / `write_binary_file`.

**Security model:** validated writes to project files go through Rust commands (`write_file`, `write_binary_file`) with `validate_writable_path` / `is_allowed_project_relative` in `src-tauri/src/main.rs`.
