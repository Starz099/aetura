/// Aetura Tauri application - video export and editing desktop application
mod constants;
mod dialogs;
mod errors;
mod ffmpeg;
mod filters;
mod models;
#[cfg(test)]
mod tests;
mod validation;

use models::{ExportRequest, ExportResult, ExportStatusEvent};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::process::{Child, Command, Stdio};
use tauri::{Emitter, Manager};
use std::fs;
use std::path::PathBuf;

#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x0800_0000;

const EXPORT_STATUS_EVENT: &str = "export-status";

fn materialize_backgrounds_dir() -> Result<PathBuf, String> {
    let base_dir = std::env::var_os("LOCALAPPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(std::env::temp_dir);
    let backgrounds_dir = base_dir.join("aetura").join("backgrounds");
    fs::create_dir_all(&backgrounds_dir)
        .map_err(|error| format!("Failed to create backgrounds directory: {}", error))?;

    let assets: [(&str, &[u8]); 4] = [
        (
            "aurora-1.png",
            include_bytes!("../../frontend/public/backgrounds/aurora-1.png"),
        ),
        (
            "night-1.png",
            include_bytes!("../../frontend/public/backgrounds/night-1.png"),
        ),
        (
            "ocean-1.png",
            include_bytes!("../../frontend/public/backgrounds/ocean-1.png"),
        ),
        (
            "sunset-1.png",
            include_bytes!("../../frontend/public/backgrounds/sunset-1.png"),
        ),
    ];

    for (filename, bytes) in assets {
        let output_path = backgrounds_dir.join(filename);
        fs::write(&output_path, bytes)
            .map_err(|error| format!("Failed to write {}: {}", output_path.display(), error))?;
    }

    Ok(backgrounds_dir)
}

/// Manages the Python engine sidecar process
#[derive(Default)]
struct EngineManager {
    process: Mutex<Option<Child>>,
    port: Mutex<u16>,
}

impl EngineManager {
    /// Spawn the Python engine on an available port
    ///
    /// `ffmpeg_path` - optional absolute path to the bundled ffmpeg sidecar. If provided
    /// it will be injected into the spawned engine process via the `FFMPEG_PATH` env var.
    fn spawn(&self, ffmpeg_path: Option<String>) -> Result<u16, String> {
        // Find an available port in the 5001-5010 range
        let mut port = 5001u16;
        let max_port = 5010u16;

        loop {
            if self.try_bind(port) {
                break;
            }
            port += 1;
            if port > max_port {
                return Err("No available ports in range 5001-5010".to_string());
            }
        }

        // Build the path to the sidecar executable
        let mut sidecar_path = std::env::current_exe()
            .map_err(|e| format!("Failed to get current exe: {}", e))?;
        sidecar_path.pop(); // Remove the executable name, go to the directory
        sidecar_path.push("main.exe");

        // Fallback: if not found, try in the app root
        if !sidecar_path.exists() {
            sidecar_path = std::env::current_exe()
                .map_err(|e| format!("Failed to get current exe: {}", e))?;
            sidecar_path.set_file_name("main.exe");
        }

        // If still not found, try the original bundled location
        if !sidecar_path.exists() {
            eprintln!(
                "[EngineManager] Warning: sidecar not found at {:?}, trying alternative paths",
                sidecar_path
            );
            sidecar_path = std::path::PathBuf::from("main.exe");
        }

        // Spawn the sidecar
        let mut command = Command::new(&sidecar_path);
        command
            .args(&[
                "--port",
                &port.to_string(),
                "--host",
                "127.0.0.1",
                "--parent-pid",
                &std::process::id().to_string(),
            ])
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null());

        // If we were given an absolute path to the bundled ffmpeg sidecar, pass it
        // to the engine process so the Python backend can use the bundled binary
        // instead of relying on system PATH.
        if let Some(ref ff) = ffmpeg_path {
            command.env("FFMPEG_PATH", ff);
        }

        #[cfg(target_os = "windows")]
        {
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let child = command
            .spawn()
            .map_err(|e| format!("Failed to spawn sidecar at {:?}: {}", sidecar_path, e))?;

        *self.process.lock().unwrap() = Some(child);
        *self.port.lock().unwrap() = port;

        println!(
            "[EngineManager] Python engine spawned at {:?} on port {}",
            sidecar_path, port
        );
        Ok(port)
    }

    /// Try to bind to a port (simple check)
    fn try_bind(&self, port: u16) -> bool {
        std::net::TcpListener::bind(("127.0.0.1", port)).is_ok()
    }

    /// Gracefully shutdown the sidecar
    fn shutdown(&self) -> Result<(), String> {
        if let Ok(mut proc_lock) = self.process.lock() {
            if let Some(mut child) = proc_lock.take() {
                println!("[EngineManager] Shutting down Python engine...");
                let _ = child.kill();
                let _ = child.wait();
            }
        }
        Ok(())
    }

    fn current_port(&self) -> Result<u16, String> {
        let port = *self
            .port
            .lock()
            .map_err(|_| "Internal error: engine port lock poisoned".to_string())?;

        if port == 0 {
            return Err("Python engine has not started yet".to_string());
        }

        Ok(port)
    }
}

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

    let path = filters::resolve_background_preset_path(&request.background.preset_id).ok_or_else(
        || {
            format!(
                "Background preset asset was not found for '{}'.",
                request.background.preset_id
            )
        },
    )?;

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
    let first_source = request.segments.first().map(|s| s.source_url.as_str()).unwrap_or("video");
    let default_filename =
        dialogs::derive_default_filename(first_source, &settings_suffix, format_extension);
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
            request.background.roundedness,
            &request.effects,
        )
    } else {
        filters::build_filter_graph(&zoom_expression, &request.effects)
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
    let _ = app.emit(
        "export-finished",
        &ExportResult {
            output_path: output_path_string.clone(),
        },
    );

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

/// Open a path (file or directory) in system file explorer
#[tauri::command]
fn open_path_in_explorer(path: String) -> Result<(), String> {
    dialogs::open_path_in_explorer(&path).map_err(|e| e.message())
}

/// Copy a file to system clipboard
#[tauri::command]
fn copy_file_to_clipboard(path: String) -> Result<(), String> {
    dialogs::copy_file_to_clipboard(&path).map_err(|e| e.message())
}

/// Get the current Python engine port.
#[tauri::command]
fn get_engine_port(app: tauri::AppHandle) -> Result<u16, String> {
    let engine_manager = app
        .try_state::<EngineManager>()
        .ok_or_else(|| "Engine manager state is unavailable".to_string())?;

    engine_manager.current_port()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .manage(ExportRuntimeState::default())
        .manage(EngineManager::default())
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // Resolve bundled ffmpeg sidecar (if present) and pass its absolute
            // path to the Python engine via the FFMPEG_PATH env var so the
            // backend uses the bundled binary instead of the system PATH.
            let ffmpeg_path = {
                // Try common candidate names under a few plausible locations:
                // - next to the running executable in a `binaries/` folder
                // - the project `src-tauri/binaries/` during dev
                let candidates = [
                    "ffmpeg",
                    "ffmpeg.exe",
                    "ffmpeg-x86_64-pc-windows-msvc.exe",
                    "ffmpeg-x86_64-unknown-linux-gnu",
                ];

                // Search multiple likely locations for the bundled sidecar. We walk
                // upward from the executable directory and from the current working
                // directory to cover both dev and packaged cases.
                let mut found: Option<std::path::PathBuf> = None;

                // Helper to test a base dir for binaries/<candidate> and base/<candidate>
                let test_base = |base: &std::path::Path| -> Option<std::path::PathBuf> {
                    for cand in &candidates {
                        let p1 = base.join("binaries").join(cand);
                        if p1.exists() {
                            return Some(p1);
                        }
                        let p2 = base.join(cand);
                        if p2.exists() {
                            return Some(p2);
                        }
                    }
                    None
                };

                // Start from the current executable location and walk up a few levels
                if let Ok(current_exe) = std::env::current_exe() {
                    if let Some(mut dir) = current_exe.parent().map(|p| p.to_path_buf()) {
                        for _ in 0..5usize {
                            if let Some(p) = test_base(&dir) {
                                found = Some(p);
                                break;
                            }
                            if !dir.pop() {
                                break;
                            }
                        }
                    }
                }

                // If still not found, try walking up from the current working directory
                if found.is_none() {
                    if let Ok(mut dir) = std::env::current_dir() {
                        for _ in 0..5usize {
                            if let Some(p) = test_base(&dir) {
                                found = Some(p);
                                break;
                            }
                            if !dir.pop() {
                                break;
                            }
                        }
                    }
                }

                if let Some(path) = found {
                    std::env::set_var("FFMPEG_PATH", &path);
                    Some(path.to_string_lossy().to_string())
                } else {
                    eprintln!("[Tauri] Could not find bundled ffmpeg sidecar in known locations");
                    None
                }
            };

            if let Ok(path) = materialize_backgrounds_dir() {
                std::env::set_var("BACKGROUNDS_PATH", path.to_string_lossy().to_string());
                println!("[Tauri] Backgrounds directory resolved to: {:?}", path);
            } else {
                eprintln!("[Tauri] Warning: Could not materialize backgrounds directory");
            }

            // Spawn Python engine sidecar, injecting FFMPEG_PATH when available
            let engine_manager = app.state::<EngineManager>();
            match engine_manager.spawn(ffmpeg_path) {
                Ok(port) => {
                    println!("[Tauri] Python engine started on port {}", port);
                }
                Err(e) => {
                    eprintln!("[Tauri] Failed to start Python engine: {}", e);
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event {
                if let Some(engine_manager) = window.app_handle().try_state::<EngineManager>() {
                    let _ = engine_manager.shutdown();
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            start_export,
            cancel_export,
            select_directory,
            open_path_in_explorer,
            copy_file_to_clipboard,
            get_engine_port
        ])
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app_handle, event| {
            if let tauri::RunEvent::ExitRequested { .. } = event {
                // Gracefully shutdown the Python engine
                if let Some(engine_manager) = app_handle.try_state::<EngineManager>() {
                    let _ = engine_manager.shutdown();
                }
            }
        });
}
