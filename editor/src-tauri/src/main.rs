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

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod build_log_filter;
mod process_util;
mod project_paths;
mod sdk;
mod web_export_status;
mod web_preview;

use std::io::{BufRead, BufReader};
use std::path::{Path, PathBuf};
use std::process::{Command as Cmd, Stdio};
use tauri::Emitter;
use tauri::Manager;

use build_log_filter::BuildLogFilter;
use process_util::{hide_console, prefer_windowless_python};
use sdk::{check_dependencies, resolve_pack_script, resolve_python_exe, resolve_workspace_root, sdk_emscripten_root, sdk_path_prefix};

// ---------------------------------------------------------------------------
// Payload type for build log events
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
struct BuildLogEntry {
    message: String,
    level: String, // "info" | "warn" | "error"
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

/// Resolve `file` to a path that is provably under canonical `root` (blocks symlink escape).
fn resolve_path_under_project_root(file: &Path, root: &Path) -> Result<PathBuf, String> {
    let root_canon = root
        .canonicalize()
        .map_err(|e| format!("project_root canonicalize '{}': {e}", root.display()))?;

    let resolved = if file.exists() {
        file.canonicalize()
            .map_err(|e| format!("path canonicalize '{}': {e}", file.display()))?
    } else if let Some(parent) = file.parent() {
        if parent.exists() {
            let parent_canon = parent
                .canonicalize()
                .map_err(|e| format!("parent canonicalize '{}': {e}", parent.display()))?;
            let name = file
                .file_name()
                .ok_or_else(|| format!("path has no file name: '{}'", file.display()))?;
            parent_canon.join(name)
        } else {
            let rel = file
                .strip_prefix(root)
                .or_else(|_| {
                    file.strip_prefix(&root_canon)
                        .map_err(|_| ())
                })
                .map_err(|_| {
                    format!(
                        "could not resolve path relative to project root '{}': '{}'",
                        root.display(),
                        file.display()
                    )
                })?;
            reject_parent_dir_components(rel)?;
            root_canon.join(rel)
        }
    } else {
        return Err(format!("invalid path (no parent): '{}'", file.display()));
    };

    if !resolved.starts_with(&root_canon) {
        return Err(format!(
            "refusing to write outside project root '{}': '{}'",
            root_canon.display(),
            resolved.display()
        ));
    }

    Ok(resolved)
}

/// Allowed writes under `project_root`: `project.json`, `scripts/**.{lua,luac}`, `dialogs/**.json`.
fn is_allowed_project_relative(rel: &Path) -> bool {
    if rel.as_os_str().is_empty() {
        return false;
    }

    if rel.components().count() == 1 {
        if let Some(Component::Normal(name)) = rel.components().next() {
            if name.eq_ignore_ascii_case("project.json") {
                return true;
            }
        }
        return false;
    }

    let ext = rel
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();

    let mut comps = rel.components();
    let first = match comps.next() {
        Some(Component::Normal(s)) => s,
        _ => return false,
    };

    if first.eq_ignore_ascii_case("scripts") {
        return ext == "lua" || ext == "luac";
    }
    if first.eq_ignore_ascii_case("dialogs") {
        return ext == "json";
    }
    if first.eq_ignore_ascii_case("assets") {
        let second = match comps.next() {
            Some(Component::Normal(s)) => s.to_ascii_lowercase(),
            _ => return false,
        };
        if second == "images" {
            return matches!(
                ext.as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp"
            );
        }
        if second == "audio" {
            return matches!(ext.as_str(), "ogg" | "wav" | "mp3" | "flac");
        }
    }

    false
}

fn validate_writable_path(path: &str, project_root: &str) -> Result<PathBuf, String> {
    let file = validate_absolute_path_no_dotdot(path, "path")?;
    let root = validate_absolute_path_no_dotdot(project_root, "project_root")?;
    let root_canon = root
        .canonicalize()
        .map_err(|e| format!("project_root canonicalize '{}': {e}", root.display()))?;

    let resolved = resolve_path_under_project_root(&file, &root)?;

    let rel = resolved.strip_prefix(&root_canon).map_err(|_| {
        format!(
            "could not resolve path relative to project root '{}': '{}'",
            root_canon.display(),
            resolved.display()
        )
    })?;

    if !is_allowed_project_relative(&rel) {
        return Err(format!(
            "refusing to write non-project artifact '{}'",
            rel.display()
        ));
    }

    Ok(resolved)
}

fn validate_build_project_root(project_root: &str) -> Result<PathBuf, String> {
    let root = validate_absolute_path_no_dotdot(project_root, "project_root")?;
    let canonical = root
        .canonicalize()
        .map_err(|e| format!("project_root canonicalize: {e}"))?;
    if !canonical.join("project.json").is_file() {
        return Err(format!(
            "project.json not found in {}",
            canonical.display()
        ));
    }
    Ok(canonical)
}

fn validate_pack_output_path(output_path: &str) -> Result<PathBuf, String> {
    let p = validate_absolute_path_no_dotdot(output_path, "output_path")?;
    let ext = p
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or_default();
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
    let p = validate_writable_path(&path, &project_root)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir '{}': {e}", parent.display()))?;
    }
    std::fs::write(&p, content).map_err(|e| format!("write '{path}': {e}"))
}

#[tauri::command]
fn write_binary_file(path: String, bytes: Vec<u8>, project_root: String) -> Result<(), String> {
    let p = validate_writable_path(&path, &project_root)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir '{}': {e}", parent.display()))?;
    }
    std::fs::write(&p, bytes).map_err(|e| format!("write binary '{path}': {e}"))
}

#[cfg(test)]
mod write_path_tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_SERIAL: AtomicU64 = AtomicU64::new(0);

    fn temp_project() -> (PathBuf, PathBuf) {
        let n = TEMP_SERIAL.fetch_add(1, Ordering::Relaxed);
        let root = std::env::temp_dir().join(format!("artcade_write_test_{n}"));
        fs::create_dir_all(&root).unwrap();
        fs::write(root.join("project.json"), r#"{"projectName":"T"}"#).unwrap();
        fs::create_dir_all(root.join("scripts")).unwrap();
        fs::create_dir_all(root.join("dialogs")).unwrap();
        let project_json = root.join("project.json");
        (root, project_json)
    }

    #[test]
    fn allows_project_json_and_scripts_and_dialogs_under_root() {
        let (root, project_json) = temp_project();
        let script = root.join("scripts").join("main.lua");
        let dialog = root.join("dialogs").join("innkeeper.json");

        assert!(validate_writable_path(&project_json.display().to_string(), &root.display().to_string()).is_ok());
        assert!(validate_writable_path(&script.display().to_string(), &root.display().to_string()).is_ok());
        assert!(validate_writable_path(&dialog.display().to_string(), &root.display().to_string()).is_ok());

        let image = root.join("assets").join("images").join("tile.png");
        assert!(validate_writable_path(&image.display().to_string(), &root.display().to_string()).is_ok());
    }

    #[test]
    fn rejects_foreign_project_json() {
        let (root, _) = temp_project();
        let other = std::env::temp_dir().join(format!(
            "artcade_foreign_{}",
            TEMP_SERIAL.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&other).unwrap();
        let foreign = other.join("project.json");
        fs::write(&foreign, "{}").unwrap();

        let err = validate_writable_path(
            &foreign.display().to_string(),
            &root.display().to_string(),
        )
        .unwrap_err();
        assert!(err.contains("outside project root"));
    }

    #[test]
    fn rejects_path_outside_root() {
        let (root, _) = temp_project();
        let outside = std::env::temp_dir().join("artcade_outside_secret.txt");
        let err = validate_writable_path(
            &outside.display().to_string(),
            &root.display().to_string(),
        )
        .unwrap_err();
        assert!(err.contains("outside project root") || err.contains("non-project"));
    }

    /// Symlink under scripts/ must not bypass the project-root check.
    #[test]
    fn rejects_symlink_escape_under_scripts() {
        let (root, _) = temp_project();
        let outside_dir = std::env::temp_dir().join(format!(
            "artcade_symlink_target_{}",
            TEMP_SERIAL.fetch_add(1, Ordering::Relaxed)
        ));
        fs::create_dir_all(&outside_dir).unwrap();
        let secret = outside_dir.join("secret.lua");
        fs::write(&secret, "-- outside").unwrap();

        let link = root.join("scripts").join("escape.lua");
        #[cfg(unix)]
        {
            use std::os::unix::fs::symlink;
            symlink(&secret, &link).expect("symlink");
        }
        #[cfg(windows)]
        {
            use std::os::windows::fs::symlink_file;
            if symlink_file(&secret, &link).is_err() {
                // Symlink creation may require elevation; skip rather than flake.
                return;
            }
        }

        let err = validate_writable_path(
            &link.display().to_string(),
            &root.display().to_string(),
        )
        .unwrap_err();
        assert!(
            err.contains("outside project root"),
            "expected outside-root error, got: {err}"
        );
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
    let resource_dir = app
        .path()
        .resource_dir()
        .map_err(|e| e.to_string())?;
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

fn copy_dir_recursive(src: &Path, dst: &Path) -> Result<(), String> {
    if !src.exists() {
        return Ok(());
    }
    std::fs::create_dir_all(dst)
        .map_err(|e| format!("create dir '{}': {e}", dst.display()))?;
    for entry in std::fs::read_dir(src)
        .map_err(|e| format!("read dir '{}': {e}", src.display()))?
    {
        let entry = entry.map_err(|e| e.to_string())?;
        let src_path = entry.path();
        let dst_path = dst.join(entry.file_name());
        let file_type = entry
            .file_type()
            .map_err(|e| format!("stat '{}': {e}", src_path.display()))?;
        if file_type.is_dir() {
            copy_dir_recursive(&src_path, &dst_path)?;
        } else if file_type.is_file() {
            std::fs::copy(&src_path, &dst_path)
                .map_err(|e| format!("copy '{}' to '{}': {e}", src_path.display(), dst_path.display()))?;
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
    let html = format!(r#"<!doctype html>
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
"#);
    let path = dist_dir.join("index.html");
    std::fs::write(&path, html).map_err(|e| format!("write '{}': {e}", path.display()))
}

// ---------------------------------------------------------------------------
// Build commands
// ---------------------------------------------------------------------------

#[tauri::command]
async fn run_build(app: tauri::AppHandle, project_root: String) -> Result<(), String> {
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
                        level: if stderr_warn { "warn".into() } else { "error".into() },
                    },
                );
            }
        });
    }
    child.wait().map_err(|e| e.to_string())
}

#[tauri::command]
async fn run_build_wasm(app: tauri::AppHandle, project_root: String) -> Result<(), String> {
    let report = check_dependencies(&app);
    if !report.ready_for_wasm_build {
        let msg = "[WASM] Missing runtime SDK or Emscripten — install SDK with Emscripten option.";
        emit_log(&app, msg, "error");
        return Err(msg.to_string());
    }

    let workspace = resolve_workspace_root()?;
    let build_wasm = workspace.join("runtime-cpp").join("build_wasm.bat");
    let wasm_app_dir = workspace.join("runtime-cpp").join("build-wasm").join("src").join("app");
    let project_root = match validate_build_project_root(&project_root) {
        Ok(p) => p,
        Err(msg) => {
            emit_log(&app, &msg, "error");
            return Err(msg);
        }
    };

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

    std::fs::copy(project_root.join("project.json"), dist_dir.join("project.json"))
        .map_err(|e| format!("copy project.json to web dist: {e}"))?;
    copy_dir_recursive(&project_root.join("scripts"), &dist_dir.join("scripts"))?;
    copy_dir_recursive(&project_root.join("assets"), &dist_dir.join("assets"))?;

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
fn get_web_export_status(project_root: String, project_dirty: bool) -> web_export_status::WebExportStatus {
    web_export_status::evaluate_web_export_status(Path::new(&project_root), project_dirty)
}

#[tauri::command]
async fn pack_project(
    app: tauri::AppHandle,
    project_root: String,
    output_path: String,
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
