# Tauri capabilities

**Edit only** [`default.json`](default.json) — never hand-edit files under `../gen/schemas/`.

After changing permissions, regenerate the bundled ACL snapshot:

```powershell
cd editor
npm run tauri:sync-schemas
```

Then commit `default.json` and, if `gen/schemas/capabilities.json` changed, that file too.

`fs:scope-home-recursive` and `fs:scope-desktop-recursive` are required so projects under Desktop / user profile paths work with the fs plugin (Open/Save, build, pack).
