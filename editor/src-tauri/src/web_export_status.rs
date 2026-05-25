//! Web export folder readiness for toolbar UX (missing / stale / ready).

use std::path::{Path, PathBuf};
use std::time::SystemTime;

use crate::project_paths::{main_script_relative_path, web_export_dist_dir};

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ExportState {
    Missing,
    Stale,
    Ready,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct WebExportStatus {
    pub state: String,
    pub dist_dir: String,
    pub hint: String,
}

impl WebExportStatus {
    fn new(state: ExportState, dist_dir: PathBuf) -> Self {
        let (state_str, hint) = match state {
            ExportState::Missing => (
                "missing",
                "Run BUILD WEB first to create a browser export",
            ),
            ExportState::Stale => (
                "stale",
                "Project changed — run BUILD WEB to refresh export",
            ),
            ExportState::Ready => (
                "ready",
                "Open last web export in browser (localhost)",
            ),
        };
        Self {
            state: state_str.to_string(),
            dist_dir: dist_dir.display().to_string(),
            hint: hint.to_string(),
        }
    }
}

fn modified_secs(path: &Path) -> Option<u64> {
    let meta = std::fs::metadata(path).ok()?;
    meta.modified()
        .ok()
        .and_then(|t| t.duration_since(SystemTime::UNIX_EPOCH).ok())
        .map(|d| d.as_secs())
}

fn export_bundle_present(dist_dir: &Path) -> bool {
    dist_dir.join("index.html").is_file() && dist_dir.join("game.wasm").is_file()
}

fn disk_sources_newer_than_export(project_root: &Path, dist_dir: &Path) -> bool {
    let index = dist_dir.join("index.html");
    let export_mtime = match modified_secs(&index) {
        Some(t) => t,
        None => return true,
    };

    let project_json = project_root.join("project.json");
    if let Some(t) = modified_secs(&project_json) {
        if t > export_mtime {
            return true;
        }
    }

    if let Some(rel) = main_script_relative_path(project_root) {
        let script = project_root.join(rel.replace('/', std::path::MAIN_SEPARATOR_STR));
        if let Some(t) = modified_secs(&script) {
            if t > export_mtime {
                return true;
            }
        }
    }

    false
}

pub fn evaluate_web_export_status(project_root: &Path, project_dirty: bool) -> WebExportStatus {
    let dist_dir = web_export_dist_dir(project_root);

    if !project_root.join("project.json").is_file() || !export_bundle_present(&dist_dir) {
        return WebExportStatus::new(ExportState::Missing, dist_dir);
    }

    if project_dirty || disk_sources_newer_than_export(project_root, &dist_dir) {
        return WebExportStatus::new(ExportState::Stale, dist_dir);
    }

    WebExportStatus::new(ExportState::Ready, dist_dir)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::thread;
    use std::time::Duration;

    fn write_file(path: &Path, content: impl AsRef<[u8]>) {
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).unwrap();
        }
        fs::write(path, content.as_ref()).unwrap();
    }

    fn temp_root(name: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("artcade_web_status_{name}_{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn missing_without_export_folder() {
        let root = temp_root("missing");
        write_file(
            &root.join("project.json"),
            r#"{"projectName":"Test","mainScriptPath":"scripts/main.lua"}"#,
        );
        let status = evaluate_web_export_status(&root, false);
        assert_eq!(status.state, "missing");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn ready_when_export_matches_project() {
        let root = temp_root("ready");
        write_file(
            &root.join("project.json"),
            r#"{"projectName":"Test","mainScriptPath":"scripts/main.lua"}"#,
        );
        write_file(&root.join("scripts/main.lua"), "-- lua");
        let dist = web_export_dist_dir(&root);
        write_file(&dist.join("index.html"), "<html></html>");
        write_file(&dist.join("game.wasm"), b"\0\0\0\0");
        thread::sleep(Duration::from_millis(50));
        let status = evaluate_web_export_status(&root, false);
        assert_eq!(status.state, "ready");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn stale_when_project_dirty_flag() {
        let root = temp_root("dirty");
        write_file(&root.join("project.json"), r#"{"projectName":"Test"}"#);
        let dist = web_export_dist_dir(&root);
        write_file(&dist.join("index.html"), "<html></html>");
        write_file(&dist.join("game.wasm"), b"\0\0\0\0");
        let status = evaluate_web_export_status(&root, true);
        assert_eq!(status.state, "stale");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn stale_when_project_json_newer_than_export() {
        let root = temp_root("mtime");
        write_file(&root.join("project.json"), r#"{"projectName":"Test"}"#);
        let dist = web_export_dist_dir(&root);
        write_file(&dist.join("index.html"), "<html></html>");
        write_file(&dist.join("game.wasm"), b"\0\0\0\0");
        thread::sleep(Duration::from_millis(1100));
        write_file(&root.join("project.json"), r#"{"projectName":"Test","version":"2"}"#);
        let status = evaluate_web_export_status(&root, false);
        assert_eq!(status.state, "stale");
        let _ = fs::remove_dir_all(root);
    }
}
