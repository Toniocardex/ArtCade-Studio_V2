//! Build log noise filter.
//!
//! CMake emits a multi-line "CMake Deprecation Warning" block when raylib or
//! Box2D set a minimum required CMake version below the one we use to drive
//! the build. The warning is harmless and originates from third-party code,
//! but every line of it lands in the editor's ConsolePanel through Tauri's
//! `build-log` event and drowns out real build output.
//!
//! `BuildLogFilter` is a tiny state machine that:
//!   1. detects the start of one of those known third-party blocks;
//!   2. suppresses every subsequent line until a NEW log record begins
//!      (a fresh CMake message, a `--` status line, a `[step]` tag, or
//!      `Built target`);
//!   3. re-enables emission on that boundary line so genuine warnings or
//!      build steps that immediately follow the suppressed block are kept.
//!
//! It does not own its own logging; callers ask `should_emit(line)` and the
//! filter only returns booleans.

pub struct BuildLogFilter {
    suppressing_third_party_cmake_warning: bool,
}

impl BuildLogFilter {
    pub fn new() -> Self {
        Self {
            suppressing_third_party_cmake_warning: false,
        }
    }

    pub fn should_emit(&mut self, line: &str) -> bool {
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

impl Default for BuildLogFilter {
    fn default() -> Self {
        Self::new()
    }
}

pub fn is_third_party_cmake_deprecation_start(line: &str) -> bool {
    line.starts_with("CMake Deprecation Warning at ")
        && (line.contains("libs/raylib/CMakeLists.txt")
            || line.contains("_deps/box2d-src/CMakeLists.txt"))
}

pub fn starts_new_build_log_record(line: &str) -> bool {
    line.starts_with("CMake ")
        || line.starts_with("-- ")
        || line.starts_with("[")
        || line.starts_with("Built target")
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn run(lines: &[&str]) -> Vec<String> {
        let mut filter = BuildLogFilter::new();
        lines
            .iter()
            .filter(|l| filter.should_emit(l))
            .map(|s| s.to_string())
            .collect()
    }

    #[test]
    fn passes_unrelated_lines_through() {
        let out = run(&[
            "-- Configuring done",
            "[ArtCade] Building runtime",
            "Built target raylib",
        ]);
        assert_eq!(out.len(), 3);
    }

    #[test]
    fn suppresses_raylib_cmake_deprecation_block() {
        let out = run(&[
            "CMake Deprecation Warning at libs/raylib/CMakeLists.txt:5 (cmake_minimum_required):",
            "  Compatibility with CMake < 3.10 will be removed from a future version of",
            "  CMake.",
            "",
            "  Update the VERSION argument <min> value or use a <min>...<max> suffix to",
            "  tell CMake that the project does not need compatibility with older versions.",
            "",
            "-- Configuring done",
        ]);
        assert_eq!(out, vec!["-- Configuring done".to_string()]);
    }

    #[test]
    fn suppresses_box2d_cmake_deprecation_block() {
        let out = run(&[
            "CMake Deprecation Warning at _deps/box2d-src/CMakeLists.txt:1 (cmake_minimum_required):",
            "  body",
            "  body continued",
            "Built target box2d",
        ]);
        assert_eq!(out, vec!["Built target box2d".to_string()]);
    }

    #[test]
    fn keeps_real_cmake_warnings_after_a_suppressed_block() {
        let out = run(&[
            "CMake Deprecation Warning at libs/raylib/CMakeLists.txt:5 (cmake_minimum_required):",
            "  body",
            "CMake Warning at src/CMakeLists.txt:42 (message):",
            "  We care about this one",
        ]);
        assert_eq!(
            out,
            vec![
                "CMake Warning at src/CMakeLists.txt:42 (message):".to_string(),
                "  We care about this one".to_string(),
            ],
            "the trailing indented line belongs to the new record, so it must pass",
        );
    }

    #[test]
    fn back_to_back_suppressed_blocks() {
        let out = run(&[
            "CMake Deprecation Warning at libs/raylib/CMakeLists.txt:5 (cmake_minimum_required):",
            "  body",
            "CMake Deprecation Warning at _deps/box2d-src/CMakeLists.txt:1 (cmake_minimum_required):",
            "  body",
            "-- Configuring done",
        ]);
        assert_eq!(out, vec!["-- Configuring done".to_string()]);
    }

    #[test]
    fn does_not_suppress_cmake_deprecation_from_our_code() {
        let out = run(&[
            "CMake Deprecation Warning at runtime-cpp/CMakeLists.txt:5 (cmake_minimum_required):",
            "  Compatibility note from our own code",
            "-- next",
        ]);
        assert_eq!(out.len(), 3);
    }

    #[test]
    fn starts_new_build_log_record_recognises_known_prefixes() {
        assert!(starts_new_build_log_record("CMake Error at foo"));
        assert!(starts_new_build_log_record("-- Anything"));
        assert!(starts_new_build_log_record("[Build] step"));
        assert!(starts_new_build_log_record("Built target raylib"));
        assert!(!starts_new_build_log_record("  indented"));
        assert!(!starts_new_build_log_record(""));
        assert!(!starts_new_build_log_record("ordinary line"));
    }
}
