/// Aetura Tauri application - video export and editing desktop application
mod dialogs;
mod errors;
mod ffmpeg;
mod filters;
mod models;
mod validation;

use models::{ExportRequest, ExportResult, ExportStatusEvent};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use tauri::Emitter;

const EXPORT_STATUS_EVENT: &str = "export-status";

fn emit_export_status(app: &tauri::AppHandle, payload: ExportStatusEvent) {
    let _ = app.emit(EXPORT_STATUS_EVENT, &payload);
}

#[derive(Default)]
struct ExportRuntimeState {
    inner: Mutex<ExportRuntimeInner>,
}

struct ExportRuntimeInner {
    is_running: bool,
    cancel_requested: Arc<AtomicBool>,
}

impl Default for ExportRuntimeInner {
    fn default() -> Self {
        Self {
            is_running: false,
            cancel_requested: Arc::new(AtomicBool::new(false)),
        }
    }
}

fn resolution_tag(resolution: &models::ExportResolution) -> &'static str {
    match resolution {
        models::ExportResolution::P720 => "720p",
        models::ExportResolution::P1080 => "1080p",
        models::ExportResolution::P4k => "4k",
    }
}

fn resolve_background_input_path(request: &ExportRequest) -> Result<Option<String>, String> {
    if !request.background.enabled {
        return Ok(None);
    }

    let path = filters::resolve_background_preset_path(&request.background.preset_id)
        .ok_or_else(|| {
            format!(
                "Background preset asset was not found for '{}'.",
                request.background.preset_id
            )
        })?;

    Ok(Some(path.to_string_lossy().to_string()))
}

/// Start the export process
/// 
/// This command:
/// 1. Validates the export request
/// 2. Prompts user for output path
/// 3. Builds FFmpeg filter graph
/// 4. Executes FFmpeg encoding
/// 5. Returns the output path
#[tauri::command]
async fn start_export(
    app: tauri::AppHandle,
    runtime_state: tauri::State<'_, ExportRuntimeState>,
    request: ExportRequest,
    default_output_directory: Option<String>,
) -> Result<ExportResult, String> {
    // Validate request
    if let Err(error) = validation::validate_request(&request) {
        let message = error.message();
        emit_export_status(&app, ExportStatusEvent::failed(message.clone()));
        return Err(message);
    }

    // Get output path from user
    let format_extension = match request.format {
        models::ExportFormat::Gif => "gif",
        models::ExportFormat::Mp4 => "mp4",
    };
    let settings_suffix = format!("{}-{}fps", resolution_tag(&request.resolution), request.fps);
    let default_filename =
        dialogs::derive_default_filename(&request.source, &settings_suffix, format_extension);
    let _destination_mode = match request.destination {
        models::ExportDestination::File => "file",
        models::ExportDestination::Clipboard => "clipboard",
    };
    let default_directory = default_output_directory
        .map(|path| path.trim().to_string())
        .filter(|path| !path.is_empty())
        .map(std::path::PathBuf::from)
        .filter(|path| path.exists() && path.is_dir());

    let mut output_path = dialogs::pick_output_path(
        &default_filename,
        format_extension,
        default_directory.as_deref(),
    )
        .map_err(|e| {
            let message = e.message();
            emit_export_status(&app, ExportStatusEvent::failed(message.clone()));
            message
        })?;

    // Enforce extension to match selected format even if the dialog returns a stale extension.
    output_path.set_extension(format_extension);
    let output_path_string = output_path.to_string_lossy().to_string();

    // Build FFmpeg filter graph
    let zoom_expression = filters::build_zoom_expression(request.effects.clone());
    let (output_width, output_height) = filters::resolution_dimensions(&request.resolution);
    let filter_graph = if request.background.enabled {
        filters::build_background_filter_graph(
            &zoom_expression,
            output_width,
            output_height,
            request.background.padding,
        )
    } else {
        filters::build_filter_graph(&zoom_expression)
    };
    let background_input_path = resolve_background_input_path(&request).map_err(|message| {
        emit_export_status(&app, ExportStatusEvent::failed(message.clone()));
        message
    })?;

    let cancel_signal = {
        let mut runtime = runtime_state
            .inner
            .lock()
            .map_err(|_| "Internal error: export runtime lock poisoned".to_string())?;

        if runtime.is_running {
            let message = "Export already running".to_string();
            emit_export_status(&app, ExportStatusEvent::failed(message.clone()));
            return Err(message);
        }

        runtime.is_running = true;
        runtime.cancel_requested.store(false, Ordering::SeqCst);
        runtime.cancel_requested.clone()
    };

    emit_export_status(&app, ExportStatusEvent::started());

    // Execute FFmpeg
    let progress_app = app.clone();
    let ffmpeg_result = ffmpeg::execute_ffmpeg(
        &request,
        &filter_graph,
        background_input_path.as_deref(),
        &output_path_string,
        move |percent| {
            emit_export_status(&progress_app, ExportStatusEvent::progress(percent));
        },
        move || cancel_signal.load(Ordering::SeqCst),
    )
        .map_err(|e| e.message());

    if let Ok(mut runtime) = runtime_state.inner.lock() {
        runtime.is_running = false;
        runtime.cancel_requested.store(false, Ordering::SeqCst);
    }

    if let Err(message) = ffmpeg_result {
        if message.starts_with("Export cancelled:") {
            emit_export_status(&app, ExportStatusEvent::cancelled(message.clone()));
        } else {
            emit_export_status(&app, ExportStatusEvent::failed(message.clone()));
        }
        return Err(message);
    }

    emit_export_status(
        &app,
        ExportStatusEvent::completed(output_path_string.clone()),
    );

    // Emit success event
    let _ = app.emit("export-finished", &ExportResult {
        output_path: output_path_string.clone(),
    });

    Ok(ExportResult {
        output_path: output_path_string,
    })
}

/// Cancel an active export process.
#[tauri::command]
fn cancel_export(runtime_state: tauri::State<ExportRuntimeState>) -> Result<(), String> {
    let runtime = runtime_state
        .inner
        .lock()
        .map_err(|_| "Internal error: export runtime lock poisoned".to_string())?;

    if !runtime.is_running {
        return Err("No export is currently running".to_string());
    }

    runtime.cancel_requested.store(true, Ordering::SeqCst);
    Ok(())
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
        .manage(ExportRuntimeState::default())
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
            cancel_export,
            select_directory,
            open_directory_in_explorer
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
