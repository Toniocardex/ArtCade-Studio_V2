//! Durable, same-directory atomic replacement for project artifacts.

use std::ffi::{OsStr, OsString};
use std::fs::{self, File, OpenOptions};
use std::io::{self, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, SystemTime};

const TEMP_MARKER: &str = ".artcade-tmp-";
const STALE_TEMP_AGE: Duration = Duration::from_secs(24 * 60 * 60);
static TEMP_SERIAL: AtomicU64 = AtomicU64::new(0);

fn temp_path_for(destination: &Path) -> io::Result<PathBuf> {
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destination has no parent"))?;
    let file_name = destination
        .file_name()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "invalid destination name"))?;

    for _ in 0..32 {
        let serial = TEMP_SERIAL.fetch_add(1, Ordering::Relaxed);
        let mut temp_name = OsString::from(".");
        temp_name.push(file_name);
        temp_name.push(format!("{TEMP_MARKER}{}-{serial}", std::process::id()));
        let candidate = parent.join(temp_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err(io::Error::new(
        io::ErrorKind::AlreadyExists,
        "could not allocate a unique atomic-write temp file",
    ))
}

fn open_new_temp(path: &Path) -> io::Result<File> {
    OpenOptions::new().write(true).create_new(true).open(path)
}

#[cfg(windows)]
fn replace_file(temp: &Path, destination: &Path) -> io::Result<()> {
    use std::os::windows::ffi::OsStrExt;

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;

    #[link(name = "kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, replacement: *const u16, flags: u32) -> i32;
    }

    let temp_wide: Vec<u16> = temp.as_os_str().encode_wide().chain(Some(0)).collect();
    let destination_wide: Vec<u16> = destination
        .as_os_str()
        .encode_wide()
        .chain(Some(0))
        .collect();
    let result = unsafe {
        MoveFileExW(
            temp_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if result == 0 {
        Err(io::Error::last_os_error())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(temp: &Path, destination: &Path) -> io::Result<()> {
    fs::rename(temp, destination)
}

#[cfg(unix)]
fn sync_parent_directory(destination: &Path) -> io::Result<()> {
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destination has no parent"))?;
    File::open(parent)?.sync_all()
}

#[cfg(not(unix))]
fn sync_parent_directory(_destination: &Path) -> io::Result<()> {
    Ok(())
}

fn backup_path_for(destination: &Path) -> PathBuf {
    let parent = destination.parent().unwrap_or_else(|| Path::new("."));
    let file_name = destination
        .file_name()
        .unwrap_or_else(|| OsStr::new("project.json"));
    let mut backup_name = OsString::from(file_name);
    backup_name.push(".bak");
    parent.join(backup_name)
}

fn file_modified_unix_ms(path: &Path) -> io::Result<u64> {
    let modified = path.metadata()?.modified()?;
    Ok(modified
        .duration_since(SystemTime::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis() as u64)
}

fn is_recovery_temp_for(destination: &Path, candidate: &Path) -> bool {
    if !is_atomic_temp_file(candidate) {
        return false;
    }
    let Some(dest_name) = destination.file_name().and_then(OsStr::to_str) else {
        return false;
    };
    let Some(temp_name) = candidate.file_name().and_then(OsStr::to_str) else {
        return false;
    };
    temp_name
        .strip_prefix('.')
        .is_some_and(|rest| rest.starts_with(dest_name))
}

/// On-disk artifacts that may exist beside a project file after save or crash.
#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectSaveArtifact {
    pub kind: &'static str,
    pub path: String,
    pub modified_unix_ms: u64,
    pub size_bytes: u64,
}

pub fn inspect_project_save_artifacts(destination: &Path) -> io::Result<Vec<ProjectSaveArtifact>> {
    let parent = destination
        .parent()
        .ok_or_else(|| io::Error::new(io::ErrorKind::InvalidInput, "destination has no parent"))?;
    let mut artifacts = Vec::new();

    let push_file = |kind: &'static str, path: &Path, out: &mut Vec<ProjectSaveArtifact>| {
        if let Ok(metadata) = path.metadata() {
            if metadata.is_file() {
                out.push(ProjectSaveArtifact {
                    kind,
                    path: path.to_string_lossy().into_owned(),
                    modified_unix_ms: file_modified_unix_ms(path).unwrap_or(0),
                    size_bytes: metadata.len(),
                });
            }
        }
    };

    push_file("saved", destination, &mut artifacts);
    push_file("backup", &backup_path_for(destination), &mut artifacts);

    if parent.is_dir() {
        if let Ok(entries) = fs::read_dir(parent) {
            for entry in entries.flatten() {
                let path = entry.path();
                if path.is_file() && is_recovery_temp_for(destination, &path) {
                    push_file("temp", &path, &mut artifacts);
                }
            }
        }
    }

    artifacts.sort_by(|left, right| right.modified_unix_ms.cmp(&left.modified_unix_ms));
    Ok(artifacts)
}

fn rotate_backup(destination: &Path) -> io::Result<()> {
    if !destination.is_file() {
        return Ok(());
    }
    let backup = backup_path_for(destination);
    fs::copy(destination, &backup).map(|_| ())
}

pub fn write_atomic(destination: &Path, bytes: &[u8]) -> io::Result<()> {
    let temp = temp_path_for(destination)?;
    let result = (|| {
        let mut file = open_new_temp(&temp)?;
        file.write_all(bytes)?;
        file.flush()?;
        file.sync_all()?;
        drop(file);
        rotate_backup(destination)?;
        replace_file(&temp, destination)?;
        sync_parent_directory(destination)
    })();

    if result.is_err() {
        let _ = fs::remove_file(&temp);
    }
    result
}

fn is_atomic_temp_file(path: &Path) -> bool {
    let Some(name) = path.file_name().and_then(OsStr::to_str) else {
        return false;
    };
    let Some((prefix, owner)) = name.rsplit_once(TEMP_MARKER) else {
        return false;
    };
    let Some((pid, serial)) = owner.split_once('-') else {
        return false;
    };
    prefix.starts_with('.')
        && prefix.len() > 1
        && pid.parse::<u32>().is_ok()
        && serial.parse::<u64>().is_ok()
}

fn cleanup_stale_in(root: &Path, now: SystemTime, minimum_age: Duration) -> io::Result<usize> {
    let mut removed = 0;
    for entry in fs::read_dir(root)? {
        let entry = entry?;
        let path = entry.path();
        let file_type = entry.file_type()?;
        if file_type.is_dir() {
            removed += cleanup_stale_in(&path, now, minimum_age)?;
            continue;
        }
        if !file_type.is_file() || !is_atomic_temp_file(&path) {
            continue;
        }
        let modified = entry
            .metadata()?
            .modified()
            .unwrap_or(SystemTime::UNIX_EPOCH);
        if now.duration_since(modified).unwrap_or_default() >= minimum_age {
            fs::remove_file(path)?;
            removed += 1;
        }
    }
    Ok(removed)
}

pub fn cleanup_stale_project_temps(root: &Path) -> io::Result<usize> {
    cleanup_stale_in(root, SystemTime::now(), STALE_TEMP_AGE)
}

#[cfg(test)]
mod tests {
    use super::*;

    fn temp_dir(label: &str) -> PathBuf {
        let serial = TEMP_SERIAL.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "artcade_atomic_{label}_{}_{serial}",
            std::process::id()
        ));
        let _ = fs::remove_dir_all(&path);
        fs::create_dir_all(&path).unwrap();
        path
    }

    #[test]
    fn creates_and_replaces_without_leaving_temp_files() {
        let root = temp_dir("replace");
        let destination = root.join("project.json");

        write_atomic(&destination, b"first").unwrap();
        write_atomic(&destination, b"second").unwrap();

        assert_eq!(fs::read(&destination).unwrap(), b"second");
        assert_eq!(fs::read_dir(&root).unwrap().count(), 2);
        assert!(root.join("project.json.bak").is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn cleanup_only_removes_artcade_temp_files() {
        let root = temp_dir("cleanup");
        let nested = root.join("assets/images");
        fs::create_dir_all(&nested).unwrap();
        fs::write(nested.join(".hero.png.artcade-tmp-1-1"), b"partial").unwrap();
        fs::write(nested.join("hero.png"), b"asset").unwrap();
        fs::write(nested.join(".unrelated.tmp"), b"keep").unwrap();
        fs::write(nested.join(".notes.artcade-tmp-user-file"), b"keep").unwrap();

        let removed = cleanup_stale_in(&root, SystemTime::now(), Duration::ZERO).unwrap();

        assert_eq!(removed, 1);
        assert!(nested.join("hero.png").is_file());
        assert!(nested.join(".unrelated.tmp").is_file());
        assert!(nested.join(".notes.artcade-tmp-user-file").is_file());
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn creates_backup_on_replace() {
        let root = temp_dir("backup");
        let destination = root.join("project.json");

        write_atomic(&destination, b"first").unwrap();
        write_atomic(&destination, b"second").unwrap();

        assert_eq!(fs::read(&destination).unwrap(), b"second");
        assert_eq!(fs::read(root.join("project.json.bak")).unwrap(), b"first");
        let _ = fs::remove_dir_all(root);
    }

    #[test]
    fn inspect_lists_saved_backup_and_temp_artifacts() {
        let root = temp_dir("inspect");
        let destination = root.join("project.json");
        fs::write(&destination, b"saved").unwrap();
        fs::write(root.join("project.json.bak"), b"backup").unwrap();
        fs::write(root.join(".project.json.artcade-tmp-1-9"), b"temp").unwrap();

        let artifacts = inspect_project_save_artifacts(&destination).unwrap();
        let kinds: Vec<_> = artifacts.iter().map(|item| item.kind).collect();
        assert!(kinds.contains(&"saved"));
        assert!(kinds.contains(&"backup"));
        assert!(kinds.contains(&"temp"));
        let _ = fs::remove_dir_all(root);
    }
}
