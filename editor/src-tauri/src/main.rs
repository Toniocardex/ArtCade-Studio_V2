// ArtCade V2 Editor — Tauri backend (Phase 19)
//
// Plugin JS-side (zero custom Rust needed):
//   @tauri-apps/plugin-dialog  → open/save dialogs
//   @tauri-apps/plugin-fs      → readTextFile / writeTextFile
//
// Custom commands here:
//   write_file   — creates parent dirs, then writes (path-validated)
//   run_build    — cmake --build + streams output as "build-log" events
//   pack_project — python pack-artcade.py + streams output

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod build_log_filter;

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command as Cmd, Stdio};
use tauri::Emitter;

use build_log_filter::BuildLogFilter;

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

fn repo_root() -> Result<PathBuf, String> {
    let manifest_dir = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    manifest_dir
        .parent()
        .and_then(|editor| editor.parent())
        .map(PathBuf::from)
        .ok_or_else(|| "could not resolve repository root from CARGO_MANIFEST_DIR".to_string())
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

/// Validate a frontend-supplied path before any write/mkdir operation.
///
/// The frontend is allowed to compose script paths from `projectPath` +
/// `mainScriptPath` (or entity scriptPath) — both potentially controlled by
/// the project author. Without validation, a hand-crafted project.json with
/// `mainScriptPath: "../../Users/x/.ssh/authorized_keys"` would scribble
/// outside the project tree the moment the user hits Save.
///
/// Rules:
///   • Must be an absolute path (parented on a real filesystem root).
///   • Must not contain any `..` parent-directory segment.
///
/// Both apply BEFORE canonicalisation so we reject obviously bogus input
/// even if the on-disk target doesn't exist yet.
fn validate_writable_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(format!("path must be absolute: '{}'", path));
    }
    use std::path::Component;
    for comp in p.components() {
        if matches!(comp, Component::ParentDir) {
            return Err(format!(
                "path may not contain '..' segments: '{}'",
                path
            ));
        }
    }
    Ok(p)
}

/// Write text to a file, creating parent directories as needed.
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let p = validate_writable_path(&path)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir '{}': {e}", parent.display()))?;
    }
    std::fs::write(&p, content).map_err(|e| format!("write '{}': {e}", path))
}

// ---------------------------------------------------------------------------
// Build commands
// ---------------------------------------------------------------------------

/// Configure and build the native runtime from the repository runtime-cpp dir.
/// Each stdout/stderr line is emitted as a "build-log" event to the frontend.
#[tauri::command]
async fn run_build(app: tauri::AppHandle, project_root: String) -> Result<(), String> {
    let repo = repo_root()?;
    let runtime_dir = repo.join("runtime-cpp");
    let build_dir = runtime_dir.join("build-native");
    let app_dir = build_dir.join("src").join("app");
    let output_package = app_dir.join("game.artcade");
    let pack_script = runtime_dir.join("tools").join("pack-artcade.py");
    let build_native = runtime_dir.join("build_native.bat");
    let project_root = PathBuf::from(project_root);

    if !build_native.exists() {
        let msg = format!(
            "[Build] Native build script not found: {}",
            build_native.display()
        );
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    if !project_root.join("project.json").exists() {
        let msg = format!(
            "[Build] project.json not found in {}",
            project_root.display()
        );
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    if !pack_script.exists() {
        let msg = format!("[Build] packer not found: {}", pack_script.display());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }

    emit_log(
        &app,
        &format!(
            "[Build] Configuring/building native runtime in {}",
            build_dir.display()
        ),
        "info",
    );

    std::fs::create_dir_all(&build_dir)
        .map_err(|e| format!("create build dir '{}': {e}", build_dir.display()))?;

    // Build + pack are run as TWO separate child processes with arguments
    // passed via Cmd::arg, never through a generated .cmd script. The
    // previous approach used format!() to splice user-controllable paths
    // (project_root) into a shell script that `cmd.exe` then re-parsed —
    // any NTFS-legal character that has special meaning to cmd (&, ^, %,
    // newline) would have broken the script and `%VAR%` inside a folder
    // name would have been expanded. Cmd::arg sends each value as one
    // argv entry, so cmd never re-parses it as script syntax.

    // Step 1 — native compile
    let build_child = Cmd::new("cmd")
        .arg("/d").arg("/c")
        .arg(&build_native)
        .arg("--config").arg("Release")
        .arg("--no-test")
        .current_dir(&repo)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start native build: {e}"))?;
    let build_status = stream_and_wait(&app, build_child, /*stderr_warn=*/ true)?;
    if !build_status.success() {
        let msg = format!("[Build] FAIL (exit {:?})", build_status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    emit_log(&app, "[Build] Build succeeded.", "info");

    // Step 2 — pack into game.artcade next to game.exe
    let pack_child = Cmd::new("python")
        .arg(&pack_script)
        .arg(&project_root)
        .arg(&output_package)
        .current_dir(&repo)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start pack-artcade: {e}"))?;
    let pack_status = stream_and_wait(&app, pack_child, /*stderr_warn=*/ false)?;
    if !pack_status.success() {
        let msg = format!("[Pack] FAIL (exit {:?})", pack_status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }

    emit_log(
        &app,
        &format!("[Build] Runnable output: {}", app_dir.display()),
        "info",
    );
    Ok(())
}

/// Drain stdout/stderr of a child process to "build-log" events and wait.
/// `stderr_warn=true` keeps the existing CMake filter behaviour for the
/// native compile step; `false` routes stderr as plain error lines.
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
                    BuildLogEntry { message: line, level: "info".into() },
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

/// Run `python tools/pack-artcade.py <project_root> <output_path>`.
#[tauri::command]
async fn pack_project(
    app: tauri::AppHandle,
    project_root: String,
    output_path: String,
) -> Result<(), String> {
    let script = repo_root()?
        .join("runtime-cpp")
        .join("tools")
        .join("pack-artcade.py");
    emit_log(
        &app,
        &format!("[Pack] python {} -> {output_path}", script.display()),
        "info",
    );

    let mut child = Cmd::new("python")
        .arg(&script)
        .arg(&project_root)
        .arg(&output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("python not found: {e}"))?;

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
            for line in BufReader::new(stderr).lines().flatten() {
                let _ = app_c.emit(
                    "build-log",
                    BuildLogEntry {
                        message: line,
                        level: "error".into(),
                    },
                );
            }
        });
    }

    match child.wait() {
        Ok(s) if s.success() => {
            emit_log(&app, "[Pack] OK .artcade created.", "info");
            Ok(())
        }
        Ok(s) => Err(format!("[Pack] FAIL exit {:?}", s.code())),
        Err(e) => Err(e.to_string()),
    }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            write_file,
            run_build,
            pack_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ArtCade Editor");
}
