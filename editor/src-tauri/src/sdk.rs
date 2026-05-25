//! ArtCade SDK resolution — dev repo vs on-demand install under %LOCALAPPDATA%/ArtCade/sdk.

use std::path::{Path, PathBuf};
use std::process::Command as Cmd;
use tauri::Manager;

#[derive(Debug, serde::Serialize, Clone)]
pub struct ToolStatus {
    pub ok: bool,
    pub path: Option<String>,
    pub detail: String,
    pub can_install: bool,
}

#[derive(Debug, serde::Serialize, Clone)]
pub struct DependencyReport {
    pub python: ToolStatus,
    pub runtime_sdk: ToolStatus,
    pub cmake: ToolStatus,
    pub ninja: ToolStatus,
    pub msvc: ToolStatus,
    pub emscripten: ToolStatus,
    pub workspace_root: Option<String>,
    pub sdk_root: String,
    pub ready_for_native_build: bool,
    pub ready_for_wasm_build: bool,
    pub ready_for_pack: bool,
}

pub fn sdk_root() -> PathBuf {
    std::env::var("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("ArtCade")
        .join("sdk")
}

fn dev_repo_root() -> Option<PathBuf> {
    let manifest = PathBuf::from(env!("CARGO_MANIFEST_DIR"));
    let root = manifest.parent()?.parent()?.to_path_buf();
    let marker = root.join("runtime-cpp").join("build_native.bat");
    if marker.is_file() {
        Some(root)
    } else {
        None
    }
}

pub fn dev_repo_root_path() -> Option<PathBuf> {
    dev_repo_root()
}

/// Workspace root: dev checkout if present, otherwise on-demand SDK directory.
pub fn resolve_workspace_root() -> Result<PathBuf, String> {
    if let Some(dev) = dev_repo_root() {
        return Ok(dev);
    }
    let sdk = sdk_root();
    let marker = sdk.join("runtime-cpp").join("build_native.bat");
    if marker.is_file() {
        return Ok(sdk);
    }
    Err(format!(
        "ArtCade runtime SDK not installed. Expected {}",
        marker.display()
    ))
}

pub fn runtime_cpp_dir() -> Result<PathBuf, String> {
    Ok(resolve_workspace_root()?.join("runtime-cpp"))
}

fn command_exists(name: &str) -> Option<PathBuf> {
    let output = Cmd::new("where").arg(name).output().ok()?;
    if !output.status.success() {
        return None;
    }
    let line = String::from_utf8_lossy(&output.stdout)
        .lines()
        .next()?
        .trim()
        .to_string();
    if line.is_empty() {
        None
    } else {
        Some(PathBuf::from(line))
    }
}

fn file_exists(path: &Path) -> bool {
    path.is_file()
}

fn find_vsdevcmd() -> Option<PathBuf> {
    if let Ok(custom) = std::env::var("ARTCADE_VSDEVCMD") {
        let p = PathBuf::from(&custom);
        if file_exists(&p) {
            return Some(p);
        }
    }
    const CANDIDATES: &[&str] = &[
        r"C:\Program Files\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat",
        r"C:\Program Files (x86)\Microsoft Visual Studio\18\BuildTools\Common7\Tools\VsDevCmd.bat",
        r"C:\Program Files\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat",
        r"C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\Common7\Tools\VsDevCmd.bat",
        r"C:\Program\Common7\Tools\VsDevCmd.bat",
    ];
    CANDIDATES
        .iter()
        .map(PathBuf::from)
        .find(|p| file_exists(p))
}

pub fn find_vsdevcmd_for_env() -> Option<String> {
    find_vsdevcmd().map(|p| p.display().to_string())
}

fn find_emscripten() -> Option<PathBuf> {
    let candidates: Vec<PathBuf> = std::env::var("EMSDK")
        .ok()
        .map(PathBuf::from)
        .into_iter()
        .chain([
            sdk_root().join("emsdk"),
            std::env::var("USERPROFILE")
                .ok()
                .map(|h| PathBuf::from(h).join("emsdk"))
                .unwrap_or_default(),
        ])
        .collect();
    for root in candidates {
        let env_bat = root.join("emsdk_env.bat");
        if file_exists(&env_bat) {
            return Some(root);
        }
    }
    None
}

pub fn resolve_python_exe(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let bundled = [
        sdk_root().join("python").join("python.exe"),
        app.path()
            .resource_dir()
            .ok()
            .map(|d| d.join("python").join("python.exe"))
            .unwrap_or_default(),
    ];
    for p in bundled {
        if file_exists(&p) {
            return Ok(p);
        }
    }
    command_exists("python").ok_or_else(|| {
        "Python not found. Install the ArtCade SDK or add Python 3 to PATH.".to_string()
    })
}

pub fn resolve_pack_script(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(runtime) = runtime_cpp_dir() {
        let p = runtime.join("tools").join("pack-artcade.py");
        if file_exists(&p) {
            return Ok(p);
        }
    }
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join("tools").join("pack-artcade.py");
        if file_exists(&p) {
            return Ok(p);
        }
    }
    Err("pack-artcade.py not found in SDK or app resources".to_string())
}

fn sdk_cmake() -> PathBuf {
    sdk_root().join("tools").join("cmake").join("bin").join("cmake.exe")
}

fn sdk_ninja() -> PathBuf {
    sdk_root().join("tools").join("ninja").join("ninja.exe")
}

pub fn sdk_path_prefix() -> String {
    let cmake_bin = sdk_root().join("tools").join("cmake").join("bin");
    let ninja_dir = sdk_root().join("tools").join("ninja");
    let mut parts = Vec::new();
    if ninja_dir.is_dir() {
        parts.push(ninja_dir.display().to_string());
    }
    if cmake_bin.is_dir() {
        parts.push(cmake_bin.display().to_string());
    }
    parts.join(";")
}

pub fn sdk_emscripten_root() -> Option<PathBuf> {
    find_emscripten()
}

pub fn check_dependencies(app: &tauri::AppHandle) -> DependencyReport {
    let sdk = sdk_root();
    let workspace = resolve_workspace_root().ok();
    let runtime_ok = workspace
        .as_ref()
        .map(|w| w.join("runtime-cpp").join("build_native.bat").is_file())
        .unwrap_or(false);

    let python_path = resolve_python_exe(app).ok();
    let python = ToolStatus {
        ok: python_path.is_some(),
        path: python_path.as_ref().map(|p| p.display().to_string()),
        detail: if python_path.is_some() {
            "Python available for .artcade export".into()
        } else {
            "Python missing — install SDK or system Python 3".into()
        },
        can_install: true,
    };

    let runtime_sdk = ToolStatus {
        ok: runtime_ok,
        path: workspace.as_ref().map(|w| w.display().to_string()),
        detail: if runtime_ok {
            if dev_repo_root().is_some() {
                "Using development runtime-cpp checkout".into()
            } else {
                "On-demand runtime SDK installed".into()
            }
        } else {
            "Runtime SDK not installed — required for native/WASM rebuild".into()
        },
        can_install: dev_repo_root().is_none(),
    };

    let cmake_path = if sdk_cmake().is_file() {
        Some(sdk_cmake())
    } else {
        command_exists("cmake")
    };
    let cmake = ToolStatus {
        ok: cmake_path.is_some(),
        path: cmake_path.as_ref().map(|p| p.display().to_string()),
        detail: cmake_path
            .as_ref()
            .map(|_| "CMake available".into())
            .unwrap_or_else(|| "CMake missing — installed with ArtCade SDK".into()),
        can_install: true,
    };

    let ninja_path = if sdk_ninja().is_file() {
        Some(sdk_ninja())
    } else {
        command_exists("ninja")
    };
    let ninja = ToolStatus {
        ok: ninja_path.is_some(),
        path: ninja_path.as_ref().map(|p| p.display().to_string()),
        detail: ninja_path
            .as_ref()
            .map(|_| "Ninja available".into())
            .unwrap_or_else(|| "Ninja missing — installed with ArtCade SDK".into()),
        can_install: true,
    };

    let vs = find_vsdevcmd();
    let msvc = ToolStatus {
        ok: vs.is_some(),
        path: vs.as_ref().map(|p| p.display().to_string()),
        detail: if vs.is_some() {
            "Visual Studio Build Tools detected (VsDevCmd)".into()
        } else {
            "MSVC not found — install VS Build Tools with Desktop C++ workload".into()
        },
        can_install: false,
    };

    let emsdk = find_emscripten();
    let emscripten = ToolStatus {
        ok: emsdk.is_some(),
        path: emsdk.as_ref().map(|p| p.display().to_string()),
        detail: if emsdk.is_some() {
            "Emscripten SDK available for WASM rebuild".into()
        } else {
            "Emscripten not installed — optional; use SDK install with Emscripten".into()
        },
        can_install: true,
    };

    let ready_for_pack = python.ok && resolve_pack_script(app).is_ok();
    let ready_for_native_build =
        runtime_ok && cmake.ok && ninja.ok && msvc.ok && python.ok;
    let ready_for_wasm_build = runtime_ok && emscripten.ok;

    DependencyReport {
        python,
        runtime_sdk,
        cmake,
        ninja,
        msvc,
        emscripten,
        workspace_root: workspace.map(|w| w.display().to_string()),
        sdk_root: sdk.display().to_string(),
        ready_for_native_build,
        ready_for_wasm_build,
        ready_for_pack,
    }
}

pub fn bootstrap_script_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    if let Ok(res) = app.path().resource_dir() {
        let bundled = res.join("scripts").join("bootstrap-artcade-sdk.ps1");
        if bundled.is_file() {
            return Ok(bundled);
        }
    }
    if let Some(dev) = dev_repo_root() {
        let p = dev.join("scripts").join("bootstrap-artcade-sdk.ps1");
        if p.is_file() {
            return Ok(p);
        }
    }
    Err("bootstrap-artcade-sdk.ps1 not found".to_string())
}
