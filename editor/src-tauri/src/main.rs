// ArtCade V2 Editor — Tauri backend (Phase 19)
//
// Plugin JS-side (zero custom Rust needed):
//   @tauri-apps/plugin-dialog  → open/save dialogs
//   @tauri-apps/plugin-fs      → readTextFile / writeTextFile
//   @tauri-apps/plugin-shell   → generic shell (if needed)
//
// Custom commands here:
//   write_file   — creates parent dirs, then writes
//   create_dir   — mkdir -p wrapper
//   resolve_path — canonicalize path
//   run_build    — cmake --build + streams output as "build-log" events
//   pack_project — python pack-artcade.py + streams output

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command as Cmd, Stdio};
use tauri::Emitter;

// ---------------------------------------------------------------------------
// Payload type for build log events
// ---------------------------------------------------------------------------

#[derive(serde::Serialize, Clone)]
struct BuildLogEntry {
    message: String,
    level:   String,   // "info" | "warn" | "error"
}

fn emit_log(app: &tauri::AppHandle, msg: &str, level: &str) {
    let _ = app.emit("build-log", BuildLogEntry {
        message: msg.to_string(),
        level:   level.to_string(),
    });
}

// ---------------------------------------------------------------------------
// File system helpers
// ---------------------------------------------------------------------------

/// Write text to a file, creating parent directories as needed.
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir '{}': {e}", parent.display()))?;
    }
    std::fs::write(&p, content)
        .map_err(|e| format!("write '{}': {e}", path))
}

/// mkdir -p wrapper.
#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    std::fs::create_dir_all(&path).map_err(|e| e.to_string())
}

/// Return the canonical absolute path.
#[tauri::command]
fn resolve_path(path: String) -> Result<String, String> {
    std::fs::canonicalize(&path)
        .map(|p| p.to_string_lossy().to_string())
        .map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// Build commands
// ---------------------------------------------------------------------------

/// Run `cmake --build <project_root>/runtime-cpp/build --config Release`.
/// Each stdout/stderr line is emitted as a "build-log" event to the frontend.
#[tauri::command]
async fn run_build(app: tauri::AppHandle, project_root: String) -> Result<(), String> {
    let build_dir = format!("{}/runtime-cpp/build", project_root);
    emit_log(&app, &format!("[Build] cmake --build {build_dir} --parallel"), "info");

    let mut child = Cmd::new("cmake")
        .args(["--build", ".", "--config", "Release", "--parallel"])
        .current_dir(&build_dir)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("cmake not found: {e}"))?;

    // Stream stdout in a background thread
    if let Some(stdout) = child.stdout.take() {
        let app_c = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().flatten() {
                let _ = app_c.emit("build-log", BuildLogEntry {
                    message: line, level: "info".into(),
                });
            }
        });
    }

    // Stream stderr in a background thread
    if let Some(stderr) = child.stderr.take() {
        let app_c = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stderr).lines().flatten() {
                let _ = app_c.emit("build-log", BuildLogEntry {
                    message: line, level: "warn".into(),
                });
            }
        });
    }

    match child.wait() {
        Ok(status) if status.success() => {
            emit_log(&app, "[Build] ✓ Build succeeded.", "info");
            Ok(())
        }
        Ok(status) => {
            let msg = format!("[Build] ✗ Failed (exit {:?})", status.code());
            emit_log(&app, &msg, "error");
            Err(msg)
        }
        Err(e) => Err(e.to_string()),
    }
}

/// Run `python tools/pack-artcade.py <project_root> <output_path>`.
#[tauri::command]
async fn pack_project(
    app:          tauri::AppHandle,
    project_root: String,
    output_path:  String,
) -> Result<(), String> {
    let script = format!("{project_root}/tools/pack-artcade.py");
    emit_log(&app, &format!("[Pack] python {script} → {output_path}"), "info");

    let mut child = Cmd::new("python")
        .args([&script, &project_root, &output_path])
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("python not found: {e}"))?;

    if let Some(stdout) = child.stdout.take() {
        let app_c = app.clone();
        std::thread::spawn(move || {
            for line in BufReader::new(stdout).lines().flatten() {
                let _ = app_c.emit("build-log", BuildLogEntry {
                    message: line, level: "info".into(),
                });
            }
        });
    }

    match child.wait() {
        Ok(s) if s.success() => {
            emit_log(&app, "[Pack] ✓ .artcade created.", "info");
            Ok(())
        }
        Ok(s) => Err(format!("[Pack] ✗ exit {:?}", s.code())),
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
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            write_file,
            create_dir,
            resolve_path,
            run_build,
            pack_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ArtCade Editor");
}
