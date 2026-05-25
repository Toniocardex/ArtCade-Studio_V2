//! Shared project folder naming (Save As, native/web export, pack).

use std::path::{Path, PathBuf};

pub fn safe_artifact_name(name: &str) -> String {
    let mut out = String::new();
    for ch in name.chars() {
        if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == ' ' {
            out.push(ch);
        } else {
            out.push('_');
        }
    }
    let trimmed = out.trim();
    if trimmed.is_empty() {
        "ArtCadeGame".to_string()
    } else {
        trimmed.to_string()
    }
}

pub fn project_display_name(project_root: &Path) -> String {
    let path = project_root.join("project.json");
    let fallback = project_root
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("ArtCadeGame")
        .to_string();
    let fallback = safe_artifact_name(&fallback);

    let Ok(text) = std::fs::read_to_string(path) else {
        return fallback;
    };
    let Ok(json) = serde_json::from_str::<serde_json::Value>(&text) else {
        return fallback;
    };
    json.get("projectName")
        .or_else(|| json.get("project_name"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(safe_artifact_name)
        .unwrap_or(fallback)
}

pub fn web_export_dist_dir(project_root: &Path) -> PathBuf {
    let game_name = project_display_name(project_root);
    project_root.join("dist").join(format!("{game_name}-web"))
}

pub fn main_script_relative_path(project_root: &Path) -> Option<String> {
    let path = project_root.join("project.json");
    let text = std::fs::read_to_string(path).ok()?;
    let json = serde_json::from_str::<serde_json::Value>(&text).ok()?;
    json.get("mainScriptPath")
        .or_else(|| json.get("main_script_path"))
        .and_then(|v| v.as_str())
        .filter(|s| !s.trim().is_empty())
        .map(|s| s.replace('\\', "/"))
}
