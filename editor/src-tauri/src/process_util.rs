//! Child process helpers — no visible console on Windows.

use std::path::{Path, PathBuf};
use std::process::Command;

/// Prevent `cmd` / `python` / `powershell` from opening a console window (Windows only).
pub fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

/// Use `pythonw.exe` when bundled next to `python.exe` (GUI subsystem, no console).
pub fn prefer_windowless_python(python: &Path) -> PathBuf {
    let file_name = python
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("");
    if file_name.eq_ignore_ascii_case("python.exe") {
        let pythonw = python.with_file_name("pythonw.exe");
        if pythonw.is_file() {
            return pythonw;
        }
    }
    python.to_path_buf()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn prefers_pythonw_next_to_python_exe() {
        let dir = std::env::temp_dir().join(format!(
            "artcade_pythonw_{}",
            std::process::id()
        ));
        let _ = std::fs::create_dir_all(&dir);
        let python = dir.join("python.exe");
        let pythonw = dir.join("pythonw.exe");
        std::fs::write(&python, b"").unwrap();
        std::fs::write(&pythonw, b"").unwrap();
        assert_eq!(
            prefer_windowless_python(&python),
            pythonw
        );
        let _ = std::fs::remove_dir_all(&dir);
    }

    #[test]
    fn keeps_path_when_no_pythonw() {
        let p = Path::new("C:\\sdk\\python.exe");
        assert_eq!(prefer_windowless_python(p), p);
    }
}
