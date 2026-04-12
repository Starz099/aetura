use serde::{Deserialize, Serialize};
use std::env;
use std::path::{Path, PathBuf};
use std::process::Command;
use tauri::Emitter;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportRequest {
  source: String,
  duration: f64,
  effects: Vec<ExportEffect>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
struct ExportEffect {
  #[serde(rename = "type")]
  effect_type: String,
  start_time: f64,
  length: f64,
  multiplier: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
struct ExportResult {
  output_path: String,
}

fn validate_request(request: &ExportRequest) -> Result<(), String> {
  if request.source.trim().is_empty() {
    return Err("Export failed: source video is missing.".to_string());
  }

  if !request.duration.is_finite() || request.duration < 0.0 {
    return Err("Export failed: duration must be a non-negative number.".to_string());
  }

  for effect in &request.effects {
    if effect.effect_type != "zoom" {
      return Err(format!(
        "Export failed: unsupported effect type '{}' for V1.",
        effect.effect_type
      ));
    }

    if !effect.start_time.is_finite() || effect.start_time < 0.0 {
      return Err("Export failed: effect startTime must be non-negative.".to_string());
    }

    if !effect.length.is_finite() || effect.length <= 0.0 {
      return Err("Export failed: effect length must be greater than zero.".to_string());
    }

    if !effect.multiplier.is_finite() || effect.multiplier < 1.0 {
      return Err("Export failed: zoom multiplier must be at least 1.0.".to_string());
    }

    if request.duration > 0.0 && (effect.start_time + effect.length > request.duration + 0.001) {
      return Err("Export failed: one or more effects exceed source duration.".to_string());
    }
  }

  Ok(())
}

fn build_zoom_expression(mut effects: Vec<ExportEffect>) -> String {
  effects.sort_by(|a, b| a.start_time.total_cmp(&b.start_time));

  if effects.is_empty() {
    return "1".to_string();
  }

  let mut expression = String::from("1");
  for effect in effects {
    let end_time = effect.start_time + effect.length;
    expression.push_str(&format!(
      "*if(between(t,{:.6},{:.6}),{:.6},1)",
      effect.start_time, end_time, effect.multiplier
    ));
  }

  expression
}

fn resolve_ffmpeg_binary() -> PathBuf {
  if let Ok(custom_path) = env::var("AETURA_FFMPEG_PATH") {
    if !custom_path.trim().is_empty() {
      return PathBuf::from(custom_path);
    }
  }

  if let Ok(current_exe) = env::current_exe() {
    if let Some(exe_dir) = current_exe.parent() {
      let candidates = [exe_dir.join("ffmpeg"), exe_dir.join("ffmpeg.exe")];
      for candidate in candidates {
        if candidate.exists() {
          return candidate;
        }
      }
    }
  }

  PathBuf::from("ffmpeg")
}

fn pick_output_path(default_name: &str, default_directory: Option<&Path>) -> Result<PathBuf, String> {
  let mut dialog = rfd::FileDialog::new()
    .set_title("Export Video")
    .set_file_name(default_name)
    .add_filter("MP4 Video", &["mp4"]);

  if let Some(directory) = default_directory {
    dialog = dialog.set_directory(directory);
  }

  dialog
    .save_file()
    .ok_or_else(|| "Export cancelled before selecting output path.".to_string())
}

fn derive_default_filename(source: &str) -> String {
  let source_name = Path::new(source)
    .file_stem()
    .and_then(|stem| stem.to_str())
    .filter(|name| !name.trim().is_empty())
    .unwrap_or("aetura-export");

  format!("{}-edited.mp4", source_name)
}

#[tauri::command]
fn select_directory(initial_directory: Option<String>) -> Result<Option<String>, String> {
  let mut dialog = rfd::FileDialog::new().set_title("Select Export Folder");

  if let Some(path) = initial_directory
    .map(|value| value.trim().to_string())
    .filter(|value| !value.is_empty())
    .map(PathBuf::from)
    .filter(|path| path.exists() && path.is_dir())
  {
    dialog = dialog.set_directory(path);
  }

  Ok(
    dialog
      .pick_folder()
      .map(|path| path.to_string_lossy().to_string()),
  )
}

#[tauri::command]
fn open_directory_in_explorer(directory: String) -> Result<(), String> {
  let path = PathBuf::from(directory.trim());

  if !path.exists() || !path.is_dir() {
    return Err("The selected directory does not exist.".to_string());
  }

  #[cfg(target_os = "windows")]
  let mut command = {
    let mut cmd = Command::new("explorer");
    cmd.arg(&path);
    cmd
  };

  #[cfg(target_os = "macos")]
  let mut command = {
    let mut cmd = Command::new("open");
    cmd.arg(&path);
    cmd
  };

  #[cfg(all(unix, not(target_os = "macos")))]
  let mut command = {
    let mut cmd = Command::new("xdg-open");
    cmd.arg(&path);
    cmd
  };

  command
    .spawn()
    .map_err(|error| format!("Failed to open directory: {}", error))?;

  Ok(())
}

#[tauri::command]
fn start_export(
  app: tauri::AppHandle,
  request: ExportRequest,
  default_output_directory: Option<String>,
) -> Result<ExportResult, String> {
  validate_request(&request)?;

  let default_filename = derive_default_filename(&request.source);
  let default_directory = default_output_directory
    .map(|path| path.trim().to_string())
    .filter(|path| !path.is_empty())
    .map(PathBuf::from)
    .filter(|path| path.exists() && path.is_dir());

  let output_path = pick_output_path(&default_filename, default_directory.as_deref())?;
  let output_path_string = output_path.to_string_lossy().to_string();

  let zoom_expression = build_zoom_expression(request.effects);
  let filter_graph = format!(
    "[0:v]split=2[base][zoomed];[zoomed]scale=w='iw*({z})':h='ih*({z})':eval=frame[scaled];[base][scaled]overlay=x='(W-w)/2':y='(H-h)/2'[vout]",
    z = zoom_expression
  );

  let ffmpeg = resolve_ffmpeg_binary();
  let ffmpeg_output = Command::new(&ffmpeg)
    .arg("-hide_banner")
    .arg("-y")
    .arg("-i")
    .arg(&request.source)
    .arg("-filter_complex")
    .arg(filter_graph)
    .arg("-map")
    .arg("[vout]")
    .arg("-map")
    .arg("0:a?")
    .arg("-c:v")
    .arg("libx264")
    .arg("-preset")
    .arg("medium")
    .arg("-crf")
    .arg("18")
    .arg("-pix_fmt")
    .arg("yuv420p")
    .arg("-c:a")
    .arg("copy")
    .arg(&output_path)
    .output()
    .map_err(|error| {
      format!(
        "Export failed: could not launch ffmpeg ({}) at {}.",
        error,
        ffmpeg.to_string_lossy()
      )
    })?;

  if !ffmpeg_output.status.success() {
    let stderr = String::from_utf8_lossy(&ffmpeg_output.stderr);
    let tail = stderr
      .lines()
      .rev()
      .take(12)
      .collect::<Vec<_>>()
      .into_iter()
      .rev()
      .collect::<Vec<_>>()
      .join("\n");

    return Err(format!("Export failed during rendering:\n{}", tail));
  }

  let _ = app.emit("export-finished", &ExportResult {
    output_path: output_path_string.clone(),
  });

  Ok(ExportResult {
    output_path: output_path_string,
  })
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
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
    .invoke_handler(tauri::generate_handler![
      start_export,
      select_directory,
      open_directory_in_explorer
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
