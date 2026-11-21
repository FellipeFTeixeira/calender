// Hide the console window in release builds on Windows.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod notes;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            notes::init(app)?;
            Ok(())
        })
        .register_uri_scheme_protocol(notes::IMG_SCHEME, notes::serve_image)
        .invoke_handler(tauri::generate_handler![
            notes::notes_load,
            notes::notes_save,
            notes::notes_delete,
            notes::image_save,
        ])
        .run(tauri::generate_context!())
        .expect("falha ao iniciar o Calendário");
}
