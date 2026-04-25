/// File dialog utilities for export workflow
use crate::errors::AppError;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Pick an output path for the exported video
pub fn pick_output_path(
    default_name: &str,
    format: &str,
    default_directory: Option<&Path>,
) -> Result<PathBuf, AppError> {
    let (title, extension) = match format {
        "gif" => ("GIF", "gif"),
        _ => ("MP4 Video", "mp4"),
    };

    let mut dialog = rfd::FileDialog::new()
        .set_title("Export Video")
        .set_file_name(default_name)
        .add_filter(title, &[extension]);

    if let Some(directory) = default_directory {
        dialog = dialog.set_directory(directory);
    }

    dialog
        .save_file()
        .ok_or_else(|| AppError::DialogCancelled("No output path selected.".to_string()))
}

/// Derive a default filename from source video path
///
/// Example: `/path/to/video.mp4` → `video-edited.mp4`
pub fn derive_default_filename(source: &str, settings_suffix: &str, extension: &str) -> String {
    let source_name = source
        .rsplit(|separator| separator == '/' || separator == '\\')
        .next()
        .and_then(|name| Path::new(name).file_stem())
        .and_then(|stem| stem.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("aetura-export");

    if settings_suffix.trim().is_empty() {
        return format!("{}-edited.{}", source_name, extension);
    }

    format!("{}-edited-{}.{}", source_name, settings_suffix, extension)
}

/// Select a directory using system file dialog
pub fn select_directory(initial_directory: Option<String>) -> Result<Option<String>, AppError> {
    let mut dialog = rfd::FileDialog::new().set_title("Select Export Folder");

    if let Some(path) = initial_directory
        .map(|value| value.trim().to_string())
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .filter(|path| path.exists() && path.is_dir())
    {
        dialog = dialog.set_directory(path);
    }

    Ok(dialog
        .pick_folder()
        .map(|path| path.to_string_lossy().to_string()))
}

/// Detect if the application is running inside WSL (Windows Subsystem for Linux)
fn is_wsl() -> bool {
    if let Ok(version) = std::fs::read_to_string("/proc/version") {
        version.to_lowercase().contains("microsoft")
    } else {
        false
    }
}

/// Convert a WSL path to a Windows path using the `wslpath` utility
fn convert_to_windows_path(path: &Path) -> Option<String> {
    let output = Command::new("wslpath")
        .arg("-w")
        .arg(path)
        .output()
        .ok()?;

    if output.status.success() {
        Some(String::from_utf8_lossy(&output.stdout).trim().to_string())
    } else {
        None
    }
}

/// Open a directory or reveal a file in the system file explorer
pub fn open_path_in_explorer(path_str: &str) -> Result<(), AppError> {
    let path = PathBuf::from(path_str.trim());

    if !path.exists() {
        return Err(AppError::IoError(
            "The selected path does not exist.".to_string(),
        ));
    }

    if is_wsl() {
        // In WSL, we use explorer.exe and convert the path to Windows format
        if let Some(windows_path) = convert_to_windows_path(&path) {
            let mut cmd = Command::new("explorer.exe");
            if path.is_file() {
                cmd.arg("/select,").arg(windows_path);
            } else {
                cmd.arg(windows_path);
            }
            cmd.spawn()
                .map_err(|e| AppError::IoError(format!("Failed to open Windows Explorer: {}", e)))?;
            return Ok(());
        }
    }

    let result = if cfg!(target_os = "windows") {
        let mut cmd = Command::new("explorer");
        if path.is_file() {
            cmd.arg("/select,").arg(&path);
        } else {
            cmd.arg(&path);
        }
        cmd.spawn()
    } else if cfg!(target_os = "macos") {
        Command::new("open").arg("-R").arg(&path).spawn()
    } else {
        // Linux
        if path.is_dir() {
            Command::new("xdg-open").arg(&path).spawn()
        } else {
            // reveal file in dir (no standard way, just open parent)
            let parent = path.parent().unwrap_or(&path);
            Command::new("xdg-open").arg(parent).spawn()
        }
    };

    result
        .map(|_| ())
        .map_err(|e| AppError::IoError(format!("Failed to open directory: {}", e)))
}

/// Copy a file to the system clipboard
pub fn copy_file_to_clipboard(path_str: &str) -> Result<(), AppError> {
    let path = PathBuf::from(path_str.trim());

    if !path.exists() || !path.is_file() {
        return Err(AppError::IoError(
            "The selected file does not exist.".to_string(),
        ));
    }

    if is_wsl() {
        if let Some(windows_path) = convert_to_windows_path(&path) {
            // Use PowerShell via explorer.exe to set the clipboard to a file drop list
            let script = format!(
                "Set-Clipboard -Path '{}'",
                windows_path
            );
            Command::new("powershell.exe")
                .arg("-NoProfile")
                .arg("-Command")
                .arg(script)
                .spawn()
                .map_err(|e| AppError::IoError(format!("Failed to copy to clipboard in WSL: {}", e)))?;
            return Ok(());
        }
    }

    let result = if cfg!(target_os = "windows") {
        let script = format!("Set-Clipboard -Path '{}'", path.to_string_lossy());
        Command::new("powershell")
            .arg("-NoProfile")
            .arg("-Command")
            .arg(script)
            .spawn()
    } else if cfg!(target_os = "macos") {
        let _script = format!(
            "set theFile to POSIX file \"{}\"\nset theClipboard to (POSIX file \"{}\") as alias\nset the clipboard to theFile",
            path.to_string_lossy(),
            path.to_string_lossy()
        );
        // More reliable way for macOS file clipboard
        let osa_script = format!(
            "osascript -e 'set the clipboard to (POSIX file \"{}\")'",
            path.to_string_lossy()
        );
        Command::new("sh").arg("-c").arg(osa_script).spawn()
    } else {
        // Linux: depends on environment, xclip is common for GNOME/files
        // This is a best-effort for Linux
        let script = format!(
            "echo -ne \"file://{}\" | xclip -i -sel clipboard -t text/uri-list",
            path.to_string_lossy()
        );
        Command::new("sh").arg("-c").arg(script).spawn()
    };

    result
        .map(|_| ())
        .map_err(|e| AppError::IoError(format!("Failed to copy to clipboard: {}", e)))
}

#[cfg(test)]
#[path = "tests/dialogs_tests.rs"]
mod tests;
