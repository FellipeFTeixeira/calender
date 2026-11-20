//! Storage for the day notes: one JSON file per note plus an attachments folder,
//! under `Documents\Calendario\data`.

use std::collections::HashSet;
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::time::{Duration, SystemTime};

use serde_json::Value;
use tauri::http::{header, Request as HttpRequest, Response, StatusCode};
use tauri::ipc::{InvokeBody, Request};
use tauri::{App, Manager, Runtime, State, UriSchemeContext};

pub const IMG_SCHEME: &str = "notasimg";
const IMG_EXT: [&str; 8] = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg", "avif"];

pub struct Paths {
    notes: PathBuf,
    images: PathBuf,
}

pub fn init(app: &mut App) -> Result<(), Box<dyn std::error::Error>> {
    let base = app.path().document_dir()?.join("Calendario").join("data");
    let notes = base.join("notes");
    let images = base.join("attachments");
    fs::create_dir_all(&notes)?;
    fs::create_dir_all(&images)?;
    app.manage(Paths { notes, images });
    Ok(())
}

/// URL prefix the webview uses to reach the custom image protocol.
fn image_url_prefix() -> &'static str {
    if cfg!(windows) {
        "http://notasimg.localhost/"
    } else {
        "notasimg://localhost/"
    }
}

fn err(e: impl std::fmt::Display) -> String {
    e.to_string()
}

fn valid_id(id: &str) -> bool {
    (1..=64).contains(&id.len()) && id.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'-')
}

fn valid_image_name(name: &str) -> bool {
    match name.rsplit_once('.') {
        Some((stem, ext)) => valid_id(stem) && IMG_EXT.contains(&ext),
        None => false,
    }
}

fn mime_for(name: &str) -> &'static str {
    match name.rsplit_once('.').map(|(_, e)| e) {
        Some("png") => "image/png",
        Some("jpg") | Some("jpeg") => "image/jpeg",
        Some("gif") => "image/gif",
        Some("webp") => "image/webp",
        Some("bmp") => "image/bmp",
        Some("svg") => "image/svg+xml",
        Some("avif") => "image/avif",
        _ => "application/octet-stream",
    }
}

/// Collects the attachment file names referenced by a note's HTML.
fn images_in(html: &str, out: &mut HashSet<String>) {
    let marker = image_url_prefix();
    let mut rest = html;
    while let Some(i) = rest.find(marker) {
        rest = &rest[i + marker.len()..];
        let end = rest
            .find(|c: char| !(c.is_ascii_alphanumeric() || c == '-' || c == '.'))
            .unwrap_or(rest.len());
        out.insert(rest[..end].to_string());
        rest = &rest[end..];
    }
}

/// Removes attachments no note references anymore. Files touched in the last
/// hour are kept so a freshly pasted image is never lost before its note saves.
fn cleanup_orphans(dir: &Path, used: &HashSet<String>) {
    let Some(cutoff) = SystemTime::now().checked_sub(Duration::from_secs(3600)) else {
        return;
    };
    let Ok(entries) = fs::read_dir(dir) else { return };
    for entry in entries.flatten() {
        let name = entry.file_name().to_string_lossy().into_owned();
        if used.contains(&name) {
            continue;
        }
        let old = entry
            .metadata()
            .and_then(|m| m.modified())
            .map(|t| t < cutoff)
            .unwrap_or(false);
        if old {
            let _ = fs::remove_file(entry.path());
        }
    }
}

#[tauri::command]
pub async fn notes_load(paths: State<'_, Paths>) -> Result<Vec<Value>, String> {
    let mut notes = Vec::new();
    let mut used = HashSet::new();
    for entry in fs::read_dir(&paths.notes).map_err(err)?.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) != Some("json") {
            continue;
        }
        let Ok(raw) = fs::read(&path) else { continue };
        let Ok(note) = serde_json::from_slice::<Value>(&raw) else { continue };
        if let Some(html) = note.get("html").and_then(Value::as_str) {
            images_in(html, &mut used);
        }
        notes.push(note);
    }
    cleanup_orphans(&paths.images, &used);
    Ok(notes)
}

#[tauri::command]
pub async fn notes_save(paths: State<'_, Paths>, note: Value) -> Result<(), String> {
    let id = note
        .get("id")
        .and_then(Value::as_str)
        .filter(|id| valid_id(id))
        .ok_or("id inválido")?;
    let file = paths.notes.join(format!("{id}.json"));
    let tmp = paths.notes.join(format!("{id}.json.tmp"));
    fs::write(&tmp, serde_json::to_vec_pretty(&note).map_err(err)?).map_err(err)?;
    fs::rename(&tmp, &file).map_err(err)
}

#[tauri::command]
pub async fn notes_delete(paths: State<'_, Paths>, id: String) -> Result<(), String> {
    if !valid_id(&id) {
        return Err("id inválido".into());
    }
    match fs::remove_file(paths.notes.join(format!("{id}.json"))) {
        Err(e) if e.kind() != ErrorKind::NotFound => Err(err(e)),
        _ => Ok(()),
    }
}

/// Receives raw image bytes (body) and the extension (`x-ext` header);
/// returns the URL to embed in the note.
#[tauri::command]
pub async fn image_save(paths: State<'_, Paths>, request: Request<'_>) -> Result<String, String> {
    let InvokeBody::Raw(bytes) = request.body() else {
        return Err("corpo inválido".into());
    };
    let ext = request
        .headers()
        .get("x-ext")
        .and_then(|v| v.to_str().ok())
        .map(|s| s.trim_start_matches('.').to_ascii_lowercase())
        .filter(|e| IMG_EXT.contains(&e.as_str()))
        .unwrap_or_else(|| "png".into());
    let name = format!("{}.{ext}", uuid::Uuid::new_v4());
    fs::write(paths.images.join(&name), bytes).map_err(err)?;
    Ok(format!("{}{name}", image_url_prefix()))
}

pub fn serve_image<R: Runtime>(
    ctx: UriSchemeContext<'_, R>,
    req: HttpRequest<Vec<u8>>,
) -> Response<Vec<u8>> {
    let not_found = || {
        Response::builder()
            .status(StatusCode::NOT_FOUND)
            .body(Vec::new())
            .unwrap()
    };
    let name = req.uri().path().trim_start_matches('/');
    if !valid_image_name(name) {
        return not_found();
    }
    let paths = ctx.app_handle().state::<Paths>();
    match fs::read(paths.images.join(name)) {
        Ok(bytes) => Response::builder()
            .header(header::CONTENT_TYPE, mime_for(name))
            .header(header::CACHE_CONTROL, "max-age=31536000, immutable")
            .body(bytes)
            .unwrap(),
        Err(_) => not_found(),
    }
}
