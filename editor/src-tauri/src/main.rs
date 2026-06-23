// ArtCade V2 Editor — Tauri backend (Phase 19)
//
// Custom commands:
//   write_file          — creates parent dirs, then writes (path-validated)
//   check_dependencies  — runtime / toolchain status
//   install_sdk         — on-demand SDK bootstrap (PowerShell)
//   run_build           — native compile + pack
//   run_build_wasm      — WASM export to dist/<name>-web/
//   open_web_export_in_browser — local http.server + default browser
//   get_web_export_status — missing / stale / ready for toolbar UX
//   pack_project        — python pack-artcade.py
//   register_project_fs_scope — allow plugin-fs access to opened project dir

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod artcade_container;
mod atomic_project_write;
mod build_log_filter;
mod process_util;
mod project_paths;
mod project_write_paths;
mod sdk;
mod web_export_status;
mod web_preview;

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command as Cmd, Stdio};
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::Emitter;
use tauri::Manager;
use tauri_plugin_fs::FsExt;

use build_log_filter::BuildLogFilter;
use process_util::{hide_console, prefer_windowless_python};
use sdk::{
    check_dependencies, resolve_pack_script, resolve_python_exe, resolve_workspace_root,
    sdk_emscripten_root, sdk_path_prefix,
};

// ---------------------------------------------------------------------------
// Payload type for build log events
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
struct BuildLogEntry {
    message: String,
    level: String, // "info" | "warn" | "error"
}

struct MainLuaOverride {
    path: PathBuf,
}

impl Drop for MainLuaOverride {
    fn drop(&mut self) {
        let _ = std::fs::remove_file(&self.path);
    }
}

fn create_main_lua_override(source: Option<String>) -> Result<Option<MainLuaOverride>, String> {
    let Some(source) = source else { return Ok(None) };
    let nonce = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|e| format!("system clock error: {e}"))?
        .as_nanos();
    let path = std::env::temp_dir().join(format!(
        "artcade-main-{}-{nonce}.lua",
        std::process::id()
    ));
    std::fs::write(&path, source)
        .map_err(|e| format!("write temporary combined Lua '{}': {e}", path.display()))?;
    Ok(Some(MainLuaOverride { path }))
}

fn apply_main_lua_override(command: &mut Cmd, override_file: &Option<MainLuaOverride>) {
    if let Some(file) = override_file {
        command.arg("--main-script-override").arg(&file.path);
    }
}

#[cfg(test)]
mod main_lua_override_tests {
    use super::create_main_lua_override;

    #[test]
    fn removes_temporary_file_when_dropped() {
        let override_file = create_main_lua_override(Some("return true".to_string()))
            .expect("override should be created")
            .expect("override should exist");
        let path = override_file.path.clone();
        assert!(path.is_file());
        drop(override_file);
        assert!(!path.exists());
    }
}

fn emit_log(app: &tauri::AppHandle, msg: &str, level: &str) {
    let _ = app.emit(
        "build-log",
        BuildLogEntry {
            message: msg.to_string(),
            level: level.to_string(),
        },
    );
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

use std::path::Component;

fn reject_parent_dir_components(path: &Path) -> Result<(), String> {
    for comp in path.components() {
        if matches!(comp, Component::ParentDir) {
            return Err(format!(
                "path may not contain '..' segments: '{}'",
                path.display()
            ));
        }
    }
    Ok(())
}

fn validate_absolute_path_no_dotdot(path: &str, label: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(format!("{label} must be absolute: '{path}'"));
    }
    reject_parent_dir_components(&p)?;
    Ok(p)
}

fn validate_build_project_root(project_root: &str) -> Result<PathBuf, String> {
    let root = validate_absolute_path_no_dotdot(project_root, "project_root")?;
    let canonical = root
        .canonicalize()
        .map_err(|e| format!("project_root canonicalize: {e}"))?;
    if !canonical.join("project.json").is_file() {
        return Err(format!("project.json not found in {}", canonical.display()));
    }
    Ok(canonical)
}

fn validate_pack_output_path(output_path: &str) -> Result<PathBuf, String> {
    let p = validate_absolute_path_no_dotdot(output_path, "output_path")?;
    let ext = p.extension().and_then(|s| s.to_str()).unwrap_or_default();
    if !ext.eq_ignore_ascii_case("artcade") {
        return Err(format!(
            "output_path must end with .artcade, got '{}'",
            p.display()
        ));
    }
    Ok(p)
}

#[tauri::command]
fn write_file(path: String, content: String, project_root: String) -> Result<(), String> {
    let p = project_write_paths::prepare_writable_path(&path, &project_root)?;
    atomic_project_write::write_atomic(&p, content.as_bytes())
        .map_err(|e| format!("atomic write '{path}': {e}"))
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>, project_root: String) -> Result<(), String> {
    let p = project_write_paths::prepare_writable_path(&path, &project_root)?;
    atomic_project_write::write_atomic(&p, &bytes)
        .map_err(|e| format!("atomic binary write '{path}': {e}"))
}

/// Decrypt an encrypted `.artcade` container into its inner plaintext ZIP bytes
/// so the editor can reopen packages it produced. Plain ZIP bytes pass through
/// unchanged, so the caller can hand any package straight to its ZIP reader.
#[tauri::command]
fn decrypt_artcade_container(bytes: Vec<u8>) -> Result<Vec<u8>, String> {
    if artcade_container::is_container(&bytes) {
        artcade_container::decrypt(&bytes)
    } else {
        Ok(bytes)
    }
}

#[cfg(test)]
mod write_path_tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_SERIAL: AtomicU64 = AtomicU64::new(0);

    fn temp_project() -> PathBuf {
        let n = TEMP_SERIAL.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!("artcade_write_test_{n}"));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("project.json"), r#"{"projectName":"T"}"#).unwrap();
        root
    }

    /// Symlink under assets/ must not be copied into web export dist.
    #[test]
    fn copy_dir_recursive_rejects_symlink_escape() {
        let root = temp_project();
        let outside_dir = std::env::temp_dir().join(format!(
            "artcade_copy_symlink_target_{}",
            TEMP_SERIAL.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&outside_dir).unwrap();
        let secret = outside_dir.join("secret.png");
        fs::write(&secret, b"outside").unwrap();

        let assets = root.join("assets");
        fs::create_dir_all(&assets).unwrap();
        let link = assets.join("escape.png");
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            symlink(&secret, &link).expect("symlink");
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::symlink_file;
            if symlink_file(&secret, &link).is_err() {
                return;
            }
        }

        let root_canon = root.canonicalize().unwrap();
        let dst = std::env::temp_dir().join(format!(
            "artcade_copy_dst_{}",
            TEMP_SERIAL.fetch_add(1, Ordering::Relaxed)
        ));
        let err = copy_dir_recursive_bounded(&assets, &dst, &root_canon).unwrap_err();
        assert!(
            err.contains("symlink") || err.contains("outside project root"),
            "expected symlink/outside-root error, got: {err}"
        );
    }
}

fn validated_project_scope_root(project_path: &str) -> Result<PathBuf, String> {
    let path = validate_absolute_path_no_dotdot(project_path, "project_path")?;
    if !path.is_file() {
        return Err(format!(
            "project_path must be an existing project.json or .artcade file: '{}'",
            path.display()
        ));
    }
    let is_project_json = path
        .file_name()
        .and_then(|name| name.to_str())
        .is_some_and(|name| name.eq_ignore_ascii_case("project.json"));
    let is_package = path
        .extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| ext.eq_ignore_ascii_case("artcade"));
    if !is_project_json && !is_package {
        return Err(format!(
            "project_path must name project.json or a .artcade package: '{}'",
            path.display()
        ));
    }
    let parent = path
        .parent()
        .ok_or_else(|| format!("project_path has no parent: '{}'", path.display()))?;
    parent
        .canonicalize()
        .map_err(|e| format!("canonicalize '{}': {e}", parent.display()))
}

/// Extend plugin-fs scope to the directory of a user-selected project file.
#[tauri::command]
fn register_project_fs_scope(app: tauri::AppHandle, project_path: String) -> Result<(), String> {
    let canon = validated_project_scope_root(&project_path)?;
    if let Err(error) = atomic_project_write::cleanup_stale_project_temps(&canon) {
        emit_log(
            &app,
            &format!("[File] Stale temp cleanup warning: {error}"),
            "warn",
        );
    }
    app.fs_scope()
        .allow_directory(&canon, true)
        .map_err(|e| format!("fs scope allow_directory: {e}"))?;
    Ok(())
}

#[cfg(test)]
mod project_scope_tests {
    use super::*;
    use std::fs;

    fn temp_dir(name: &str) -> PathBuf {
        let path =
            std::env::temp_dir().join(format!("artcade_scope_{name}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn accepts_project_json_and_artcade_files() {
        let temp = temp_dir("accepted");
        let project = temp.join("project.json");
        let package = temp.join("game.artcade");
        fs::write(&project, "{}").unwrap();
        fs::write(&package, []).unwrap();

        assert_eq!(
            validated_project_scope_root(project.to_str().unwrap()).unwrap(),
            temp.canonicalize().unwrap()
        );
        assert_eq!(
            validated_project_scope_root(package.to_str().unwrap()).unwrap(),
            temp.canonicalize().unwrap()
        );
        let _ = fs::remove_dir_all(temp);
    }

    #[test]
    fn rejects_arbitrary_files_and_directories() {
        let temp = temp_dir("rejected");
        let text = temp.join("notes.txt");
        fs::write(&text, "secret").unwrap();

        assert!(validated_project_scope_root(text.to_str().unwrap()).is_err());
        assert!(validated_project_scope_root(temp.to_str().unwrap()).is_err());
        let _ = fs::remove_dir_all(temp);
    }
}

// ---------------------------------------------------------------------------
// Dependency / SDK commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn check_dependencies_cmd(app: tauri::AppHandle) -> sdk::DependencyReport {
    check_dependencies(&app)
}

#[tauri::command]
async fn install_sdk(
    app: tauri::AppHandle,
    include_emscripten: Option<bool>,
) -> Result<(), String> {
    let script = sdk::bootstrap_script_path(&app)?;
    let sdk_root = sdk::sdk_root();
    let resource_dir = app.path().resource_dir().map_err(|e| e.to_string())?;
    let include_ems = include_emscripten.unwrap_or(false);

    emit_log(
        &app,
        &format!(
            "[SDK] Installing ArtCade SDK to {} (emscripten={include_ems})…",
            sdk_root.display()
        ),
        "info",
    );

    let mut cmd = Cmd::new("powershell");
    cmd.arg("-NoProfile")
        .arg("-ExecutionPolicy")
        .arg("Bypass")
        .arg("-File")
        .arg(&script)
        .arg("-SdkRoot")
        .arg(&sdk_root)
        .arg("-ResourceDir")
        .arg(&resource_dir)
        .arg("-IncludeEmscripten")
        .arg(if include_ems { "true" } else { "false" });
    if let Some(dev) = sdk::dev_repo_root_path() {
        cmd.arg("-DevRepoRoot").arg(dev);
    }
    hide_console(&mut cmd);
    let child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start SDK installer: {e}"))?;

    let status = stream_and_wait(&app, child, false)?;
    if !status.success() {
        let msg = format!("[SDK] Install failed (exit {:?})", status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }

    emit_log(&app, "[SDK] Install completed.", "info");
    Ok(())
}

fn apply_sdk_env(cmd: &mut Cmd) {
    let prefix = sdk_path_prefix();
    if !prefix.is_empty() {
        let path = std::env::var("PATH").unwrap_or_default();
        cmd.env("PATH", format!("{prefix};{path}"));
    }
    if let Ok(root) = resolve_workspace_root() {
        cmd.env("ARTCADE_WORKSPACE", &root);
    }
    if let Some(vs) = sdk::find_vsdevcmd_for_env() {
        cmd.env("ARTCADE_VSDEVCMD", vs);
    }
    if let Some(emsdk) = sdk_emscripten_root() {
        cmd.env("EMSDK", &emsdk);
    }
}

/// Copy `src` tree into `dst`, refusing symlinks and paths outside `boundary_root`.
fn copy_dir_recursive_bounded(src: &Path, dst: &Path, boundary_root: &Path) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }

    let src_canon = src
        .canonicalize()
        .map_err(|e| format!("canonicalize '{}': {e}", src.display()))?;
    if !src_canon.starts_with(boundary_root) {
        return Err(format!(
            "refusing to copy outside project root '{}': '{}'",
            boundary_root.display(),
            src_canon.display()
        ));
    }

    std::fs::create_dir_all(dst).map_err(|e| format!("create dir '{}': {e}", dst.display()))?;
    for entry in std::fs::read_dir(&src_canon)
        .map_err(|e| format!("read dir '{}': {e}", src_canon.display()))?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        let file_type = entry
            .file_type()
            .map_err(|e| format!("stat '{}': {e}", src_path.display()))?;
        if file_type.is_symlink() {
            return Err(format!(
                "refusing to copy symlink during web export: '{}'",
                src_path.display()
            ));
        }
        let resolved = src_path
            .canonicalize()
            .map_err(|e| format!("canonicalize '{}': {e}", src_path.display()))?;
        if !resolved.starts_with(boundary_root) {
            return Err(format!(
                "refusing to copy path outside project root '{}': '{}'",
                boundary_root.display(),
                resolved.display()
            ));
        }
        if file_type.is_dir() {
            copy_dir_recursive_bounded(&resolved, &dst_path, boundary_root)?;
        } else if file_type.is_file() {
            std::fs::copy(&resolved, &dst_path).map_err(|e| {
                format!(
                    "copy '{}' to '{}': {e}",
                    resolved.display(),
                    dst_path.display()
                )
            })?;
        }
    }
    Ok(())
}

fn write_web_shell(dist_dir: &Path, title: &str) -> Result<(), String> {
    let escaped_title = title
        .replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
        .replace('"', "&quot;");
    let html = format!(
        r#"<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{escaped_title}</title>
  <style>
    html, body {{
      margin: 0;
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #101318;
      color: #e5e7eb;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
    }}
    #artcade-canvas {{
      display: block;
      width: 100vw;
      height: 100vh;
      background: #101318;
    }}
    #status {{
      position: fixed;
      left: 16px;
      bottom: 14px;
      padding: 6px 9px;
      border: 1px solid rgb(255 255 255 / 0.14);
      background: rgb(0 0 0 / 0.45);
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.3;
      pointer-events: none;
    }}
  </style>
</head>
<body>
  <canvas id="artcade-canvas"></canvas>
  <div id="status">Loading...</div>
  <script>
    const statusEl = document.getElementById('status');
    const canvas = document.getElementById('artcade-canvas');
    const textDecoder = new TextDecoder('utf-8');

    function setStatus(message) {{
      statusEl.textContent = message;
      console.log('[ArtCade]', message);
    }}

    function callWithString(name, value) {{
      const bytes = Module.lengthBytesUTF8(value) + 1;
      const ptr = Module._malloc(bytes);
      try {{
        Module.stringToUTF8(value, ptr, bytes);
        Module.ccall(name, null, ['number'], [ptr]);
      }} finally {{
        Module._free(ptr);
      }}
    }}

    async function fetchText(path) {{
      const res = await fetch(path, {{ cache: 'no-store' }});
      if (!res.ok) throw new Error(`${{path}}: ${{res.status}} ${{res.statusText}}`);
      return await res.text();
    }}

    async function fetchBytes(path) {{
      const res = await fetch(path, {{ cache: 'no-store' }});
      if (!res.ok) throw new Error(`${{path}}: ${{res.status}} ${{res.statusText}}`);
      return new Uint8Array(await res.arrayBuffer());
    }}

    function registerImage(path, bytes) {{
      if (!bytes || bytes.length === 0) return;
      const ext = '.' + (path.split('.').pop() || 'png').toLowerCase();
      const pathBytes = Module.lengthBytesUTF8(path) + 1;
      const extBytes = Module.lengthBytesUTF8(ext) + 1;
      const pathPtr = Module._malloc(pathBytes);
      const extPtr = Module._malloc(extBytes);
      const dataPtr = Module._malloc(bytes.length);
      try {{
        Module.stringToUTF8(path, pathPtr, pathBytes);
        Module.stringToUTF8(ext, extPtr, extBytes);
        Module.HEAPU8.set(bytes, dataPtr);
        Module.ccall(
          'editor_register_image',
          null,
          ['number', 'number', 'number', 'number'],
          [pathPtr, dataPtr, bytes.length, extPtr],
        );
      }} finally {{
        Module._free(dataPtr);
        Module._free(extPtr);
        Module._free(pathPtr);
      }}
    }}

    async function bootGame() {{
      setStatus('Loading project...');
      const projectJson = await fetchText('project.json');
      const project = JSON.parse(projectJson);
      const assets = Object.values(project.assets || {{}});

      for (const asset of assets) {{
        if (!asset || !asset.path) continue;
        try {{
          registerImage(asset.path, await fetchBytes(asset.path));
        }} catch (err) {{
          console.warn('[ArtCade] Failed to load image asset', asset.path, err);
        }}
      }}

      callWithString('editor_load_project', projectJson);

      const mainScriptPath = project.mainScriptPath || project.main_script_path || 'scripts/main.lua';
      const mainLua = await fetchText(mainScriptPath);
      callWithString('editor_reload_script', mainLua);
      Module.ccall('editor_set_mode', null, ['number'], [1]);
      setStatus('Ready');
      setTimeout(() => statusEl.remove(), 900);
    }}

    window.onConsoleLine = (message, level) => {{
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
      fn('[Runtime]', message);
    }};

    window.Module = {{
      canvas,
      locateFile(path) {{ return path; }},
      print(text) {{ console.log(text); }},
      printErr(text) {{ console.error(text); }},
      onRuntimeInitialized() {{
        bootGame().catch((err) => {{
          console.error(err);
          setStatus(`Error: ${{err.message || err}}`);
        }});
      }},
    }};
  </script>
  <script async src="game.js"></script>
</body>
</html>
"#
    );
    let path = dist_dir.join("index.html");
    std::fs::write(&path, html).map_err(|e| format!("write '{}': {e}", path.display()))
}

// ---------------------------------------------------------------------------
// Build commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn run_build(
    app: tauri::AppHandle,
    project_root: String,
    main_lua: Option<String>,
) -> Result<(), String> {
    let report = check_dependencies(&app);
    if !report.ready_for_native_build {
        let msg = "[Build] Missing dependencies — install the ArtCade SDK and VS Build Tools first (Build → Check dependencies).";
        emit_log(&app, msg, "error");
        return Err(msg.to_string());
    }

    let workspace = resolve_workspace_root()?;
    let runtime_dir = workspace.join("runtime-cpp");
    let build_dir = runtime_dir.join("build-native");
    let app_dir = build_dir.join("src").join("app");
    let runtime_exe = app_dir.join("game.exe");
    let output_package = app_dir.join("game.artcade");
    let pack_script = resolve_pack_script(&app)?;
    let build_native = runtime_dir.join("build_native.bat");
    let python = prefer_windowless_python(&resolve_python_exe(&app)?);
    let project_root = match validate_build_project_root(&project_root) {
        Ok(p) => p,
        Err(msg) => {
            emit_log(&app, &msg, "error");
            return Err(msg);
        }
    };
    let main_lua_override = create_main_lua_override(main_lua)?;

    emit_log(
        &app,
        &format!(
            "[Build] Workspace: {} — building in {}",
            workspace.display(),
            build_dir.display()
        ),
        "info",
    );

    std::fs::create_dir_all(&build_dir)
        .map_err(|e| format!("create build dir '{}': {e}", build_dir.display()))?;

    let mut build_child = Cmd::new("cmd");
    build_child
        .arg("/d")
        .arg("/c")
        .arg(&build_native)
        .arg("--config")
        .arg("Release")
        .arg("--no-test")
        .current_dir(&workspace)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_sdk_env(&mut build_child);
    hide_console(&mut build_child);

    let build_child = build_child
        .spawn()
        .map_err(|e| format!("failed to start native build: {e}"))?;
    let build_status = stream_and_wait(&app, build_child, true)?;
    if !build_status.success() {
        let msg = format!("[Build] FAIL (exit {:?})", build_status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    if !runtime_exe.exists() {
        let msg = format!("[Build] game.exe not found at {}", runtime_exe.display());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    emit_log(&app, "[Build] Build succeeded.", "info");

    let mut pack_child = Cmd::new(&python);
    pack_child
        .arg(&pack_script)
        .arg(&project_root)
        .arg(&output_package)
        .current_dir(&workspace)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_main_lua_override(&mut pack_child, &main_lua_override);
    hide_console(&mut pack_child);

    let pack_child = pack_child
        .spawn()
        .map_err(|e| format!("failed to start pack-artcade: {e}"))?;
    let pack_status = stream_and_wait(&app, pack_child, false)?;
    if !pack_status.success() {
        let msg = format!("[Pack] FAIL (exit {:?})", pack_status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }

    let game_name = project_paths::project_display_name(&project_root);
    let dist_dir = project_root.join("dist").join(&game_name);
    std::fs::create_dir_all(&dist_dir)
        .map_err(|e| format!("create dist dir '{}': {e}", dist_dir.display()))?;
    let dist_exe = dist_dir.join(format!("{game_name}.exe"));
    let dist_package = dist_dir.join("game.artcade");
    std::fs::copy(&runtime_exe, &dist_exe)
        .map_err(|e| format!("copy executable to '{}': {e}", dist_exe.display()))?;
    std::fs::copy(&output_package, &dist_package)
        .map_err(|e| format!("copy package to '{}': {e}", dist_package.display()))?;

    emit_log(
        &app,
        &format!("[Build] Release folder: {}", dist_dir.display()),
        "info",
    );
    Ok(())
}

fn stream_and_wait(
    app: &tauri::AppHandle,
    mut child: std::process::Child,
    stderr_warn: bool,
) -> Result<std::process::ExitStatus, String> {
    if let Some(stdout) = child.stdout.take() {
        let app_c = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().flatten() {
                let _ = app_c.emit(
                    "build-log",
                    BuildLogEntry {
                        message: line,
                        level: "info".into(),
                    },
                );
            }
        });
    }
    if let Some(stderr) = child.stderr.take() {
        let app_c = app.clone();
        std::thread::spawn(move || {
            let mut filter = BuildLogFilter::new();
            for line in BufReader::new(stderr).lines().flatten() {
                if stderr_warn && !filter.should_emit(&line) {
                    continue;
                }
                let _ = app_c.emit(
                    "build-log",
                    BuildLogEntry {
                        message: line,
                        level: if stderr_warn {
                            "warn".into()
                        } else {
                            "error".into()
                        },
                    },
                );
            }
        });
    }
    child.wait().map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_build_wasm(
    app: tauri::AppHandle,
    project_root: String,
    main_lua: Option<String>,
) -> Result<(), String> {
    let report = check_dependencies(&app);
    if !report.ready_for_wasm_build {
        let msg = "[WASM] Missing runtime SDK or Emscripten — install SDK with Emscripten option.";
        emit_log(&app, msg, "error");
        return Err(msg.to_string());
    }

    let workspace = resolve_workspace_root()?;
    let build_wasm = workspace.join("runtime-cpp").join("build_wasm.bat");
    let wasm_app_dir = workspace
        .join("runtime-cpp")
        .join("build-wasm")
        .join("src")
        .join("app");
    let project_root = match validate_build_project_root(&project_root) {
        Ok(p) => p,
        Err(msg) => {
            emit_log(&app, &msg, "error");
            return Err(msg);
        }
    };
    let main_lua_override = create_main_lua_override(main_lua)?;

    emit_log(
        &app,
        &format!("[WASM] Building runtime via {}", build_wasm.display()),
        "info",
    );

    let mut child = Cmd::new("cmd");
    child
        .arg("/d")
        .arg("/c")
        .arg(&build_wasm)
        .current_dir(&workspace.join("runtime-cpp"))
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_sdk_env(&mut child);
    hide_console(&mut child);

    let child = child
        .spawn()
        .map_err(|e| format!("failed to start WASM build: {e}"))?;
    let status = stream_and_wait(&app, child, true)?;
    if !status.success() {
        let msg = format!("[WASM] FAIL (exit {:?})", status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    let game_name = project_paths::project_display_name(&project_root);
    let dist_dir = project_paths::web_export_dist_dir(&project_root);
    std::fs::create_dir_all(&dist_dir)
        .map_err(|e| format!("create web dist dir '{}': {e}", dist_dir.display()))?;

    for file_name in ["game.js", "game.wasm", "game.data"] {
        let src = wasm_app_dir.join(file_name);
        if src.exists() {
            let dst = dist_dir.join(file_name);
            std::fs::copy(&src, &dst)
                .map_err(|e| format!("copy '{}' to '{}': {e}", src.display(), dst.display()))?;
        } else if file_name != "game.data" {
            let msg = format!("[WASM] Missing output: {}", src.display());
            emit_log(&app, &msg, "error");
            return Err(msg);
        }
    }

    std::fs::copy(
        project_root.join("project.json"),
        dist_dir.join("project.json"),
    )
    .map_err(|e| format!("copy project.json to web dist: {e}"))?;
    let boundary_root = project_root.canonicalize().map_err(|e| {
        format!(
            "canonicalize project root '{}': {e}",
            project_root.display()
        )
    })?;
    copy_dir_recursive_bounded(
        &boundary_root.join("scripts"),
        &dist_dir.join("scripts"),
        &boundary_root,
    )?;
    copy_dir_recursive_bounded(
        &boundary_root.join("assets"),
        &dist_dir.join("assets"),
        &boundary_root,
    )?;

    let pack_script = resolve_pack_script(&app)?;
    let python = prefer_windowless_python(&resolve_python_exe(&app)?);
    let output_package = dist_dir.join("game.artcade");
    let mut pack_child = Cmd::new(&python);
    pack_child
        .arg(&pack_script)
        .arg(&project_root)
        .arg(&output_package)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_main_lua_override(&mut pack_child, &main_lua_override);
    hide_console(&mut pack_child);
    let pack_child = pack_child
        .spawn()
        .map_err(|e| format!("failed to start pack-artcade: {e}"))?;

    let pack_status = stream_and_wait(&app, pack_child, false)?;
    if !pack_status.success() {
        let msg = format!("[Pack] FAIL (exit {:?})", pack_status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }

    write_web_shell(&dist_dir, &game_name)?;

    emit_log(
        &app,
        &format!("[WASM] Web export folder: {}", dist_dir.display()),
        "info",
    );
    Ok(())
}

#[tauri::command]
async fn open_web_export_in_browser(
    app: tauri::AppHandle,
    project_root: String,
) -> Result<String, String> {
    let project_root = match validate_build_project_root(&project_root) {
        Ok(p) => p,
        Err(msg) => {
            emit_log(&app, &msg, "error");
            return Err(msg);
        }
    };

    let dist_dir = project_paths::web_export_dist_dir(&project_root);
    let url = web_preview::serve_web_export(&app, &dist_dir)?;
    emit_log(
        &app,
        &format!(
            "[Web] Opened browser — {url} (serving {})",
            dist_dir.display()
        ),
        "info",
    );
    Ok(url)
}

#[tauri::command]
fn get_web_export_status(
    project_root: String,
    project_dirty: bool,
) -> web_export_status::WebExportStatus {
    match validate_build_project_root(&project_root) {
        Ok(root) => web_export_status::evaluate_web_export_status(&root, project_dirty),
        Err(_) => {
            let dist = project_paths::web_export_dist_dir(Path::new(&project_root));
            web_export_status::WebExportStatus::new(web_export_status::ExportState::Missing, dist)
        }
    }
}

#[tauri::command]
async fn pack_project(
    app: tauri::AppHandle,
    project_root: String,
    output_path: String,
    main_lua: Option<String>,
) -> Result<(), String> {
    let report = check_dependencies(&app);
    if !report.ready_for_pack {
        let msg = "[Pack] Python or pack script missing — install the ArtCade SDK first.";
        emit_log(&app, msg, "error");
        return Err(msg.to_string());
    }

    let script = resolve_pack_script(&app)?;
    let python = prefer_windowless_python(&resolve_python_exe(&app)?);

    let project_root = validate_build_project_root(&project_root)?;
    let output_path = validate_pack_output_path(&output_path)?;
    let main_lua_override = create_main_lua_override(main_lua)?;

    emit_log(
        &app,
        &format!(
            "[Pack] {} {} -> {}",
            python.display(),
            script.display(),
            output_path.display()
        ),
        "info",
    );

    let mut child = Cmd::new(&python);
    child
        .arg(&script)
        .arg(&project_root)
        .arg(&output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());
    apply_main_lua_override(&mut child, &main_lua_override);
    hide_console(&mut child);
    let child = child
        .spawn()
        .map_err(|e| format!("failed to start packer: {e}"))?;

    let status = stream_and_wait(&app, child, false)?;
    if !status.success() {
        return Err(format!("[Pack] FAIL exit {:?}", status.code()));
    }

    emit_log(&app, "[Pack] OK .artcade created.", "info");
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            write_file,
            write_binary_file,
            decrypt_artcade_container,
            register_project_fs_scope,
            check_dependencies_cmd,
            install_sdk,
            run_build,
            run_build_wasm,
            open_web_export_in_browser,
            get_web_export_status,
            pack_project,
        ])
        .build(tauri::generate_context!())
        .expect("error while building ArtCade Editor")
        .run(|_app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                web_preview::shutdown_web_preview_server();
            }
        });
}
