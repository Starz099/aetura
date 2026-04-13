/// Aetura Tauri application - video export and editing desktop application
mod dialogs;
mod errors;
mod ffmpeg;
mod filters;
mod models;
mod validation;

use models::{ExportRequest, ExportResult};
use tauri::Emitter;

/// Start the export process
/// 
/// This command:
/// 1. Validates the export request
/// 2. Prompts user for output path
/// 3. Builds FFmpeg filter graph
/// 4. Executes FFmpeg encoding
/// 5. Returns the output path
#[tauri::command]
fn start_export(
    app: tauri::AppHandle,
    request: ExportRequest,
    default_output_directory: Option<String>,
) -> Result<ExportResult, String> {
    // Validate request
    validation::validate_request(&request).map_err(|e| e.message())?;

    // Get output path from user
    let default_filename = dialogs::derive_default_filename(&request.source);
    let default_directory = default_output_directory
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .map(std::path::PathBuf::from)
        .filter(|path| path.exists() && path.is_dir());

    let output_path = dialogs::pick_output_path(&default_filename, default_directory.as_deref())
        .map_err(|e| e.message())?;
    let output_path_string = output_path.to_string_lossy().to_string();

    // Build FFmpeg filter graph
    let zoom_expression = filters::build_zoom_expression(request.effects);
    let filter_graph = filters::build_filter_graph(&zoom_expression);

    // Execute FFmpeg
    ffmpeg::execute_ffmpeg(&request.source, &filter_graph, &output_path_string)
        .map_err(|e| e.message())?;

    // Emit success event
    let _ = app.emit("export-finished", &ExportResult {
        output_path: output_path_string.clone(),
    });

    Ok(ExportResult {
        output_path: output_path_string,
    })
}

/// Select a directory for export
#[tauri::command]
fn select_directory(initial_directory: Option<String>) -> Result<Option<String>, String> {
    dialogs::select_directory(initial_directory).map_err(|e| e.message())
}

/// Open a directory in system file explorer
#[tauri::command]
fn open_directory_in_explorer(directory: String) -> Result<(), String> {
    dialogs::open_directory_in_explorer(&directory).map_err(|e| e.message())
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
