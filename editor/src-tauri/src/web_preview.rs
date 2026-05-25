//! Local HTTP server for exported web builds (WASM + fetch require http://).

use std::net::TcpListener;
use std::path::Path;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

use crate::process_util::{hide_console, prefer_windowless_python};
use crate::sdk::resolve_python_exe;

static WEB_PREVIEW_SERVER: Mutex<Option<Child>> = Mutex::new(None);

/// Kill the localhost preview server (e.g. when the editor exits).
pub fn shutdown_web_preview_server() {
    stop_web_preview_server();
}

fn stop_web_preview_server() {
    let mut guard = WEB_PREVIEW_SERVER.lock().unwrap_or_else(|e| e.into_inner());
    if let Some(mut child) = guard.take() {
        let _ = child.kill();
        let _ = child.wait();
    }
}

fn pick_free_port() -> Result<u16, String> {
    let listener = TcpListener::bind("127.0.0.1:0")
        .map_err(|e| format!("cannot bind ephemeral port: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("local_addr: {e}"))?
        .port();
    drop(listener);
    Ok(port)
}

fn open_system_browser(url: &str) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        let mut cmd = Command::new("cmd");
        cmd.args(["/C", "start", "", url])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());
        hide_console(&mut cmd);
        cmd.spawn()
            .map_err(|e| format!("failed to open browser: {e}"))?;
    }
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("failed to open browser: {e}"))?;
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos")))]
    {
        Command::new("xdg-open")
            .arg(url)
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .spawn()
            .map_err(|e| format!("failed to open browser: {e}"))?;
    }
    Ok(())
}

/// Start (or restart) `python -m http.server` for `dist_dir` and open `index.html` in the default browser.
pub fn serve_web_export(app: &tauri::AppHandle, dist_dir: &Path) -> Result<String, String> {
    let index_html = dist_dir.join("index.html");
    let game_wasm = dist_dir.join("game.wasm");
    if !index_html.is_file() {
        return Err(format!(
            "web export not found at {} — run BUILD WEB first",
            dist_dir.display()
        ));
    }
    if !game_wasm.is_file() {
        return Err(format!(
            "missing game.wasm in {} — run BUILD WEB first",
            dist_dir.display()
        ));
    }

    let python = prefer_windowless_python(&resolve_python_exe(app)?);
    let port = pick_free_port()?;
    let url = format!("http://127.0.0.1:{port}/index.html");

    stop_web_preview_server();

    let mut child_cmd = Command::new(&python);
    child_cmd
        .arg("-m")
        .arg("http.server")
        .arg(port.to_string())
        .arg("--bind")
        .arg("127.0.0.1")
        .arg("--directory")
        .arg(dist_dir)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        // Pipe stderr so we can read the startup failure message during the
        // initial settle window, but drain it on a background thread for the
        // rest of the server's lifetime. `http.server` writes one access-log
        // line per request to stderr; if nobody reads the pipe its OS buffer
        // (~64 KB on Windows) eventually fills and Python blocks on write —
        // the server stops responding without any error surface.
        .stderr(Stdio::piped());
    hide_console(&mut child_cmd);
    let mut child = child_cmd
        .spawn()
        .map_err(|e| format!("failed to start Python http.server: {e}"))?;

    thread::sleep(Duration::from_millis(350));
    if let Ok(Some(status)) = child.try_wait() {
        let mut stderr = String::new();
        if let Some(mut err) = child.stderr.take() {
            use std::io::Read;
            let _ = err.read_to_string(&mut stderr);
        }
        return Err(format!(
            "web preview server exited ({status}); {stderr}"
        ));
    }

    if let Some(stderr) = child.stderr.take() {
        thread::spawn(move || {
            use std::io::Read;
            let mut sink = stderr;
            let mut buf = [0u8; 4096];
            loop {
                match sink.read(&mut buf) {
                    Ok(0) | Err(_) => break,
                    Ok(_) => {}
                }
            }
        });
    }

    {
        let mut guard = WEB_PREVIEW_SERVER.lock().unwrap_or_else(|e| e.into_inner());
        *guard = Some(child);
    }

    open_system_browser(&url)?;
    Ok(url)
}
