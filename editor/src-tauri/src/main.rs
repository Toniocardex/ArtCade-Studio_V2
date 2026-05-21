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

struct BuildLogFilter {
    suppressing_third_party_cmake_warning: bool,
}

impl BuildLogFilter {
    fn new() -> Self {
        Self {
            suppressing_third_party_cmake_warning: false,
        }
    }

    fn should_emit(&mut self, line: &str) -> bool {
        if is_third_party_cmake_deprecation_start(line) {
            self.suppressing_third_party_cmake_warning = true;
            return false;
        }

        if self.suppressing_third_party_cmake_warning {
            if starts_new_build_log_record(line) {
                self.suppressing_third_party_cmake_warning = false;
                return self.should_emit(line);
            }
            return false;
        }

        true
    }
}

fn is_third_party_cmake_deprecation_start(line: &str) -> bool {
    line.starts_with("CMake Deprecation Warning at ")
        && (line.contains("libs/raylib/CMakeLists.txt")
            || line.contains("_deps/box2d-src/CMakeLists.txt"))
}

fn starts_new_build_log_record(line: &str) -> bool {
    line.starts_with("CMake ")
        || line.starts_with("-- ")
        || line.starts_with("[")
        || line.starts_with("Built target")
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

/// Write text to a file, creating parent directories as needed.
#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let p = PathBuf::from(&path);
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir '{}': {e}", parent.display()))?;
    }
    std::fs::write(&p, content).map_err(|e| format!("write '{}': {e}", path))
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

/// Configure and build the native runtime from the repository runtime-cpp dir.
/// Each stdout/stderr line is emitted as a "build-log" event to the frontend.
#[tauri::command]
async fn run_build(app: tauri::AppHandle, project_root: String) -> Result<(), String> {
    let repo = repo_root()?;
    let runtime_dir = repo.join("runtime-cpp");
    let build_dir = runtime_dir.join("build-msvc");
    let app_dir = build_dir.join("src").join("app");
    let output_package = app_dir.join("game.artcade");
    let pack_script = runtime_dir.join("tools").join("pack-artcade.py");
    let project_root = PathBuf::from(project_root);
    let vsdev_cmd = PathBuf::from(
        r"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat",
    );

    if !vsdev_cmd.exists() {
        let msg = format!(
            "[Build] Visual Studio DevCmd not found: {}",
            vsdev_cmd.display()
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

    let script_path = build_dir.join("artcade-tauri-build.cmd");
    let script = format!(
        "@echo off\r\n\
         call \"{}\" -arch=x64\r\n\
         if errorlevel 1 exit /b %errorlevel%\r\n\
         cmake -S \"{}\" -B \"{}\" -G \"NMake Makefiles\" -Wno-dev -DARTCADE_BUILD_TESTS=ON -DCMAKE_BUILD_TYPE=Release -DCMAKE_POLICY_VERSION_MINIMUM=3.5\r\n\
         if errorlevel 1 exit /b %errorlevel%\r\n\
         cmake --build \"{}\" --config Release\r\n\
         if errorlevel 1 exit /b %errorlevel%\r\n\
         python \"{}\" \"{}\" \"{}\"\r\n\
         exit /b %errorlevel%\r\n",
        vsdev_cmd.display(),
        runtime_dir.display(),
        build_dir.display(),
        build_dir.display(),
        pack_script.display(),
        project_root.display(),
        output_package.display(),
    );
    std::fs::write(&script_path, script)
        .map_err(|e| format!("write build script '{}': {e}", script_path.display()))?;

    let mut child = Cmd::new("cmd")
        .arg("/d")
        .arg("/c")
        .arg(&script_path)
        .current_dir(&repo)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()
        .map_err(|e| format!("failed to start native build: {e}"))?;

    // Stream stdout in a background thread
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

    // Stream stderr in a background thread
    if let Some(stderr) = child.stderr.take() {
        let app_c = app.clone();
        std::thread::spawn(move || {
            let mut filter = BuildLogFilter::new();
            for line in BufReader::new(stderr).lines().flatten() {
                if !filter.should_emit(&line) {
                    continue;
                }
                let _ = app_c.emit(
                    "build-log",
                    BuildLogEntry {
                        message: line,
                        level: "warn".into(),
                    },
                );
            }
        });
    }

    match child.wait() {
        Ok(status) if status.success() => {
            emit_log(&app, "[Build] Build succeeded.", "info");
            emit_log(
                &app,
                &format!("[Build] Runnable output: {}", app_dir.display()),
                "info",
            );
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
