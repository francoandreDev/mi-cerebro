// why: ffmpeg is bundled as a sidecar (externalBin) but never spawned by the
//      JS layer directly — yt-dlp spawns it itself via `--ffmpeg-location`.
//      Tauri stages every externalBin next to the app's own executable in
//      both dev and production, but — verified empirically running a real
//      `bun tauri dev` window (this can't be checked from a headless
//      sandbox) — it strips the source target-triple suffix down to the
//      bare sidecar name (`ffmpeg`, not `ffmpeg-x86_64-unknown-linux-gnu`)
//      so that `Command::sidecar(name)` can resolve it without knowing the
//      triple at runtime. Check the exact name first; keep the old
//      prefix-match as a fallback in case some target retains the suffix.
#[tauri::command]
fn sidecar_path(name: String) -> Result<String, String> {
  let exe = std::env::current_exe().map_err(|e| e.to_string())?;
  let dir = exe
    .parent()
    .ok_or_else(|| "current executable has no parent directory".to_string())?;
  for candidate in [dir.join(&name), dir.join(format!("{name}.exe"))] {
    if candidate.is_file() {
      return Ok(candidate.to_string_lossy().into_owned());
    }
  }
  let prefix = format!("{name}-");
  let entries = std::fs::read_dir(dir).map_err(|e| e.to_string())?;
  for entry in entries.flatten() {
    let filename = entry.file_name().to_string_lossy().into_owned();
    if filename.starts_with(&prefix) {
      return Ok(entry.path().to_string_lossy().into_owned());
    }
  }
  Err(format!("no sidecar named '{name}' found next to the executable"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_fs::init())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_store::Builder::new().build())
    .plugin(tauri_plugin_shell::init())
    .invoke_handler(tauri::generate_handler![sidecar_path])
    .setup(|app| {
      if cfg!(debug_assertions) {
        app.handle().plugin(
          tauri_plugin_log::Builder::default()
            .level(log::LevelFilter::Info)
            .build(),
        )?;
      }
      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
