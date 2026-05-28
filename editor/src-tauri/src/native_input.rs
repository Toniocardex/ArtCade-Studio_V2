//! Native OS text-input dialogs (Win32 on Windows via tinyfiledialogs C library).

/// Modal native input box. Returns `None` when the user cancels or submits empty text.
pub fn show_text_input(title: &str, message: &str, default: &str) -> Option<String> {
    let value = tinyfiledialogs::input_box(title, message, default)?;
    let trimmed = value.trim();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed.to_string())
    }
}
