//! Sandboxed project-file writes, including first-save project creation.

use std::path::{Component, Path, PathBuf};

fn reject_parent_dir_components(path: &Path) -> Result<(), String> {
    for component in path.components() {
        if matches!(component, Component::ParentDir) {
            return Err(format!(
                "path may not contain '..' segments: '{}'",
                path.display()
            ));
        }
    }
    Ok(())
}

fn validate_absolute_path(path: &str, label: &str) -> Result<PathBuf, String> {
    let path = PathBuf::from(path);
    if !path.is_absolute() {
        return Err(format!("{label} must be absolute: '{}'", path.display()));
    }
    reject_parent_dir_components(&path)?;
    Ok(path)
}

fn canonical_root_for_write(root: &Path) -> Result<PathBuf, String> {
    if root.exists() {
        if !root.is_dir() {
            return Err(format!(
                "project_root must be a directory: '{}'",
                root.display()
            ));
        }
        return root
            .canonicalize()
            .map_err(|error| format!("project_root canonicalize '{}': {error}", root.display()));
    }

    let parent = root
        .parent()
        .ok_or_else(|| format!("project_root has no parent: '{}'", root.display()))?;
    let parent_canon = parent.canonicalize().map_err(|error| {
        format!(
            "project_root parent canonicalize '{}': {error}",
            parent.display()
        )
    })?;
    let name = root
        .file_name()
        .ok_or_else(|| format!("project_root has no directory name: '{}'", root.display()))?;
    Ok(parent_canon.join(name))
}

fn resolve_under_root(file: &Path, root: &Path, root_canon: &Path) -> Result<PathBuf, String> {
    let resolved = if file.exists() {
        file.canonicalize()
            .map_err(|error| format!("path canonicalize '{}': {error}", file.display()))?
    } else if let Some(parent) = file.parent() {
        if parent.exists() {
            let parent_canon = parent
                .canonicalize()
                .map_err(|error| format!("parent canonicalize '{}': {error}", parent.display()))?;
            let name = file
                .file_name()
                .ok_or_else(|| format!("path has no file name: '{}'", file.display()))?;
            parent_canon.join(name)
        } else {
            let relative = file
                .strip_prefix(root)
                .or_else(|_| file.strip_prefix(root_canon).map_err(|_| ()))
                .map_err(|_| {
                    format!(
                        "could not resolve path relative to project root '{}': '{}'",
                        root.display(),
                        file.display()
                    )
                })?;
            reject_parent_dir_components(relative)?;
            root_canon.join(relative)
        }
    } else {
        return Err(format!("invalid path (no parent): '{}'", file.display()));
    };

    if !resolved.starts_with(root_canon) {
        return Err(format!(
            "refusing to write outside project root '{}': '{}'",
            root_canon.display(),
            resolved.display()
        ));
    }
    Ok(resolved)
}

fn is_allowed_project_relative(relative: &Path) -> bool {
    if relative.as_os_str().is_empty() {
        return false;
    }

    if relative.components().count() == 1 {
        return relative
            .file_name()
            .and_then(|name| name.to_str())
            .is_some_and(|name| name.eq_ignore_ascii_case("project.json"));
    }

    let extension = relative
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    let mut components = relative.components();
    let first = match components.next() {
        Some(Component::Normal(value)) => value,
        _ => return false,
    };

    if first.eq_ignore_ascii_case("scripts") {
        return extension == "lua" || extension == "luac";
    }
    if first.eq_ignore_ascii_case("dialogs") {
        return extension == "json";
    }
    if first.eq_ignore_ascii_case("assets") {
        let second = match components.next() {
            Some(Component::Normal(value)) => value.to_ascii_lowercase(),
            _ => return false,
        };
        return if second == "images" {
            matches!(
                extension.as_str(),
                "png" | "jpg" | "jpeg" | "gif" | "webp" | "bmp"
            )
        } else if second == "audio" {
            matches!(extension.as_str(), "ogg" | "wav" | "mp3" | "flac")
        } else if second == "fonts" {
            matches!(extension.as_str(), "ttf" | "otf" | "woff" | "woff2")
        } else {
            false
        };
    }
    false
}

fn validate_writable_path(path: &str, project_root: &str) -> Result<PathBuf, String> {
    let file = validate_absolute_path(path, "path")?;
    let root = validate_absolute_path(project_root, "project_root")?;
    let root_canon = canonical_root_for_write(&root)?;
    let resolved = resolve_under_root(&file, &root, &root_canon)?;
    let relative = resolved.strip_prefix(&root_canon).map_err(|_| {
        format!(
            "could not resolve path relative to project root '{}': '{}'",
            root_canon.display(),
            resolved.display()
        )
    })?;

    if !is_allowed_project_relative(relative) {
        return Err(format!(
            "refusing to write non-project artifact '{}'",
            relative.display()
        ));
    }
    Ok(resolved)
}

/// Validate a project artifact path, create its parent directories, then
/// validate again to prevent a newly created symlink/reparse point escaping
/// the project root before the caller writes the file.
pub fn prepare_writable_path(path: &str, project_root: &str) -> Result<PathBuf, String> {
    let initial = validate_writable_path(path, project_root)?;
    let parent = initial
        .parent()
        .ok_or_else(|| format!("path has no parent: '{}'", initial.display()))?;
    std::fs::create_dir_all(parent)
        .map_err(|error| format!("mkdir '{}': {error}", parent.display()))?;
    validate_writable_path(path, project_root)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::{AtomicU64, Ordering};

    static TEMP_SERIAL: AtomicU64 = AtomicU64::new(0);

    fn temp_dir(label: &str) -> PathBuf {
        let serial = TEMP_SERIAL.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!("artcade_write_{label}_{serial}"));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn prepares_first_save_when_project_root_does_not_exist() {
        let parent = temp_dir("new_project");
        let root = parent.join("Untitled");
        let project_json = root.join("project.json");

        let resolved =
            prepare_writable_path(project_json.to_str().unwrap(), root.to_str().unwrap()).unwrap();

        assert!(root.is_dir());
        assert_eq!(resolved, root.canonicalize().unwrap().join("project.json"));
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn rejects_new_project_when_selected_parent_does_not_exist() {
        let parent = temp_dir("missing_parent");
        let root = parent.join("missing").join("Untitled");
        let project_json = root.join("project.json");

        let error = prepare_writable_path(project_json.to_str().unwrap(), root.to_str().unwrap())
            .unwrap_err();

        assert!(error.contains("parent canonicalize"));
        assert!(!root.exists());
        let _ = fs::remove_dir_all(parent);
    }

    #[test]
    fn allows_supported_project_artifacts() {
        let root = temp_dir("artifacts");
        for relative in [
            "project.json",
            "scripts/main.lua",
            "dialogs/innkeeper.json",
            "assets/images/tile.png",
            "assets/audio/theme.ogg",
            "assets/fonts/ui.ttf",
        ] {
            let path = root.join(relative);
            assert!(prepare_writable_path(path.to_str().unwrap(), root.to_str().unwrap()).is_ok());
        }
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_path_outside_root() {
        let root = temp_dir("root");
        let outside = root.parent().unwrap().join("artcade_outside_secret.lua");
        let error =
            validate_writable_path(outside.to_str().unwrap(), root.to_str().unwrap()).unwrap_err();
        assert!(error.contains("outside project root"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_non_project_artifact() {
        let root = temp_dir("artifact_reject");
        let path = root.join("notes.txt");
        let error =
            validate_writable_path(path.to_str().unwrap(), root.to_str().unwrap()).unwrap_err();
        assert!(error.contains("non-project artifact"));
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn rejects_symlink_escape_under_scripts() {
        let root = temp_dir("symlink_root");
        let scripts = root.join("scripts");
        fs::create_dir_all(&scripts).unwrap();
        let outside = temp_dir("symlink_target").join("secret.lua");
        fs::write(&outside, "-- outside").unwrap();
        let link = scripts.join("escape.lua");

        #[cfg(unix)]
        std::os::unix::fs::symlink(&outside, &link).unwrap();
        #[cfg(windows)]
        if std::os::windows::fs::symlink_file(&outside, &link).is_err() {
            return;
        }

        let error =
            validate_writable_path(link.to_str().unwrap(), root.to_str().unwrap()).unwrap_err();
        assert!(error.contains("outside project root"));
        let _ = fs::remove_dir_all(root);
        let _ = fs::remove_file(outside);
    }
}
