// ArtCade V2 Editor — Tauri backend (Phase 19)
//
// Custom commands:
//   write_file          — creates parent dirs, then writes (path-validated)
//   check_dependencies  — runtime / toolchain status
//   install_sdk         — on-demand SDK bootstrap (PowerShell)
//   run_build           — native compile + pack
//   pack_project        — python pack-artcade.py

#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod build_log_filter;
mod sdk;

use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command as Cmd, Stdio};
use tauri::Emitter;
use tauri::Manager;

use build_log_filter::BuildLogFilter;
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

fn validate_writable_path(path: &str) -> Result<PathBuf, String> {
    let p = PathBuf::from(path);
    if !p.is_absolute() {
        return Err(format!("path must be absolute: '{path}'"));
    }
    use std::path::Component;
    for comp in p.components() {
        if matches!(comp, Component::ParentDir) {
            return Err(format!("path may not contain '..' segments: '{path}'"));
        }
    }
    Ok(p)
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    let p = validate_writable_path(&path)?;
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent)
            .map_err(|e| format!("mkdir '{}': {e}", parent.display()))?;
    }
    std::fs::write(&p, content).map_err(|e| format!("write '{path}': {e}"))
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
    let output_package = app_dir.join("game.artcade");
    let pack_script = resolve_pack_script(&app)?;
    let build_native = runtime_dir.join("build_native.bat");
    let python = resolve_python_exe(&app)?;
    let project_root = PathBuf::from(project_root);

    if !project_root.join("project.json").exists() {
        let msg = format!(
            "[Build] project.json not found in {}",
            project_root.display()
        );
        emit_log(&app, &msg, "error");
        return Err(msg);
    }

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

    let build_child = build_child
        .spawn()
        .map_err(|e| format!("failed to start native build: {e}"))?;
    let build_status = stream_and_wait(&app, build_child, true)?;
    if !build_status.success() {
        let msg = format!("[Build] FAIL (exit {:?})", build_status.code());
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

    let pack_child = pack_child
        .spawn()
        .map_err(|e| format!("failed to start pack-artcade: {e}"))?;
    let pack_status = stream_and_wait(&app, pack_child, false)?;
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
async fn run_build_wasm(app: tauri::AppHandle) -> Result<(), String> {
    let report = check_dependencies(&app);
    if !report.ready_for_wasm_build {
        let msg = "[WASM] Missing runtime SDK or Emscripten — install SDK with Emscripten option.";
        emit_log(&app, msg, "error");
        return Err(msg.to_string());
    }

    let workspace = resolve_workspace_root()?;
    let build_wasm = workspace.join("runtime-cpp").join("build_wasm.bat");

    emit_log(
        &app,
        &format!("[WASM] Rebuilding preview via {}", build_wasm.display()),
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

    let child = child
        .spawn()
        .map_err(|e| format!("failed to start WASM build: {e}"))?;
    let status = stream_and_wait(&app, child, true)?;
    if !status.success() {
        let msg = format!("[WASM] FAIL (exit {:?})", status.code());
        emit_log(&app, &msg, "error");
        return Err(msg);
    }
    emit_log(&app, "[WASM] Preview runtime updated.", "info");
    Ok(())
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
    let python = resolve_python_exe(&app)?;

    emit_log(
        &app,
        &format!(
            "[Pack] {} {} -> {output_path}",
            python.display(),
            script.display()
        ),
        "info",
    );

    let child = Cmd::new(&python)
        .arg(&script)
        .arg(&project_root)
        .arg(&output_path)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
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
            check_dependencies_cmd,
            install_sdk,
            run_build,
            run_build_wasm,
            pack_project,
        ])
        .run(tauri::generate_context!())
        .expect("error while running ArtCade Editor");
}
