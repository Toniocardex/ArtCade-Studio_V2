//! Native local HTTP server for exported web builds (WASM + fetch require http://).

use std::fs::File;
use std::io::{self, BufRead, BufReader, Write};
use std::net::{TcpListener, TcpStream};
use std::path::{Component, Path, PathBuf};
use std::process::{Command, Stdio};
use std::sync::mpsc::{self, Sender, TryRecvError};
use std::sync::Mutex;
use std::thread::{self, JoinHandle};
use std::time::Duration;

use crate::process_util::hide_console;

struct PreviewServer {
    stop: Sender<()>,
    thread: JoinHandle<()>,
}

static WEB_PREVIEW_SERVER: Mutex<Option<PreviewServer>> = Mutex::new(None);

/// Stop the localhost preview server (e.g. when the editor exits).
pub fn shutdown_web_preview_server() {
    stop_web_preview_server();
}

fn stop_web_preview_server() {
    let server = WEB_PREVIEW_SERVER
        .lock()
        .unwrap_or_else(|e| e.into_inner())
        .take();
    if let Some(server) = server {
        let _ = server.stop.send(());
        let _ = server.thread.join();
    }
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

fn decode_url_path(raw: &str) -> Result<String, String> {
    let path = raw.split(['?', '#']).next().unwrap_or(raw);
    let bytes = path.as_bytes();
    let mut decoded = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' {
            if i + 2 >= bytes.len() {
                return Err("incomplete URL escape".into());
            }
            let hex =
                std::str::from_utf8(&bytes[i + 1..i + 3]).map_err(|_| "invalid URL escape")?;
            decoded.push(u8::from_str_radix(hex, 16).map_err(|_| "invalid URL escape")?);
            i += 3;
        } else {
            decoded.push(bytes[i]);
            i += 1;
        }
    }
    String::from_utf8(decoded).map_err(|_| "URL path is not UTF-8".into())
}

fn resolve_request_path(root: &Path, raw: &str) -> Result<PathBuf, String> {
    let decoded = decode_url_path(raw)?;
    let relative = decoded.trim_start_matches('/');
    let relative = if relative.is_empty() {
        "index.html"
    } else {
        relative
    };
    let path = Path::new(relative);
    if path.components().any(|component| {
        matches!(
            component,
            Component::ParentDir | Component::RootDir | Component::Prefix(_)
        )
    }) {
        return Err("request path escapes preview root".into());
    }
    let candidate = root.join(path);
    let canonical = candidate
        .canonicalize()
        .map_err(|_| "requested file not found".to_string())?;
    if !canonical.starts_with(root) || !canonical.is_file() {
        return Err("requested file is outside preview root".into());
    }
    Ok(canonical)
}

fn mime_type(path: &Path) -> &'static str {
    match path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase()
        .as_str()
    {
        "html" => "text/html; charset=utf-8",
        "js" | "mjs" => "text/javascript; charset=utf-8",
        "css" => "text/css; charset=utf-8",
        "json" => "application/json; charset=utf-8",
        "wasm" => "application/wasm",
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "wav" => "audio/wav",
        "ogg" => "audio/ogg",
        "mp3" => "audio/mpeg",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        "woff" => "font/woff",
        "woff2" => "font/woff2",
        _ => "application/octet-stream",
    }
}

fn write_error(stream: &mut TcpStream, status: &str, body: &str) -> io::Result<()> {
    write!(
        stream,
        "HTTP/1.1 {status}\r\nContent-Type: text/plain; charset=utf-8\r\nContent-Length: {}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n{body}",
        body.len()
    )
}

fn handle_connection(mut stream: TcpStream, root: &Path) -> io::Result<()> {
    stream.set_read_timeout(Some(Duration::from_secs(2)))?;
    let mut request_line = String::new();
    BufReader::new(stream.try_clone()?).read_line(&mut request_line)?;
    if request_line.len() > 8192 {
        return write_error(&mut stream, "414 URI Too Long", "request URI too long");
    }
    let mut parts = request_line.split_whitespace();
    let method = parts.next().unwrap_or_default();
    let target = parts.next().unwrap_or_default();
    if method != "GET" && method != "HEAD" {
        return write_error(&mut stream, "405 Method Not Allowed", "method not allowed");
    }
    let path = match resolve_request_path(root, target) {
        Ok(path) => path,
        Err(_) => return write_error(&mut stream, "404 Not Found", "not found"),
    };
    let mut file = File::open(&path)?;
    let length = file.metadata()?.len();
    write!(
        stream,
        "HTTP/1.1 200 OK\r\nContent-Type: {}\r\nContent-Length: {length}\r\nCache-Control: no-store\r\nX-Content-Type-Options: nosniff\r\nConnection: close\r\n\r\n",
        mime_type(&path)
    )?;
    if method == "GET" {
        io::copy(&mut file, &mut stream)?;
    }
    Ok(())
}

fn spawn_server(listener: TcpListener, root: PathBuf) -> Result<PreviewServer, String> {
    listener
        .set_nonblocking(true)
        .map_err(|e| format!("set preview listener nonblocking: {e}"))?;
    let (stop, stop_rx) = mpsc::channel();
    let thread = thread::spawn(move || loop {
        match stop_rx.try_recv() {
            Ok(()) | Err(TryRecvError::Disconnected) => break,
            Err(TryRecvError::Empty) => {}
        }
        match listener.accept() {
            Ok((stream, _)) => {
                let _ = handle_connection(stream, &root);
            }
            Err(error) if error.kind() == io::ErrorKind::WouldBlock => {
                thread::sleep(Duration::from_millis(10));
            }
            Err(_) => break,
        }
    });
    Ok(PreviewServer { stop, thread })
}

/// Start the built-in HTTP server for `dist_dir` and open it in the default browser.
pub fn serve_web_export(_app: &tauri::AppHandle, dist_dir: &Path) -> Result<String, String> {
    let root = dist_dir
        .canonicalize()
        .map_err(|e| format!("invalid web export directory '{}': {e}", dist_dir.display()))?;
    if !root.join("index.html").is_file() {
        return Err(format!(
            "web export not found at {} - run BUILD WEB first",
            root.display()
        ));
    }
    if !root.join("game.wasm").is_file() {
        return Err(format!(
            "missing game.wasm in {} - run BUILD WEB first",
            root.display()
        ));
    }

    stop_web_preview_server();
    let listener =
        TcpListener::bind("127.0.0.1:0").map_err(|e| format!("cannot bind preview server: {e}"))?;
    let port = listener
        .local_addr()
        .map_err(|e| format!("read preview server address: {e}"))?
        .port();
    let server = spawn_server(listener, root)?;
    let url = format!("http://127.0.0.1:{port}/index.html");

    *WEB_PREVIEW_SERVER.lock().unwrap_or_else(|e| e.into_inner()) = Some(server);
    if let Err(error) = open_system_browser(&url) {
        stop_web_preview_server();
        return Err(error);
    }
    Ok(url)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn request_paths_stay_inside_preview_root() {
        let temp =
            std::env::temp_dir().join(format!("artcade_preview_paths_{}", std::process::id()));
        let _ = fs::remove_dir_all(&temp);
        fs::create_dir_all(&temp).unwrap();
        fs::write(temp.join("index.html"), "ok").unwrap();
        let root = temp.canonicalize().unwrap();

        assert_eq!(
            resolve_request_path(&root, "/").unwrap(),
            root.join("index.html")
        );
        assert!(resolve_request_path(&root, "/../secret.txt").is_err());
        assert!(resolve_request_path(&root, "/%2e%2e/secret.txt").is_err());
        let _ = fs::remove_dir_all(temp);
    }
}
