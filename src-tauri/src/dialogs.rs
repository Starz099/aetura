/// File dialog utilities for export workflow
use crate::errors::AppError;
use std::path::{Path, PathBuf};
use std::process::Command;

/// Pick an output path for the exported video
pub fn pick_output_path(
    default_name: &str,
    default_directory: Option<&Path>,
) -> Result<PathBuf, AppError> {
    let mut dialog = rfd::FileDialog::new()
        .set_title("Export Video")
        .set_file_name(default_name)
        .add_filter("MP4 Video", &["mp4"]);

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
pub fn derive_default_filename(source: &str) -> String {
    let source_name = source
        .rsplit(|separator| separator == '/' || separator == '\\')
        .next()
        .and_then(|name| Path::new(name).file_stem())
        .and_then(|stem| stem.to_str())
        .filter(|name| !name.trim().is_empty())
        .unwrap_or("aetura-export");

    format!("{}-edited.mp4", source_name)
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

    Ok(
        dialog
            .pick_folder()
            .map(|path| path.to_string_lossy().to_string()),
    )
}

/// Open a directory in the system file explorer
pub fn open_directory_in_explorer(directory: &str) -> Result<(), AppError> {
    let path = PathBuf::from(directory.trim());

    if !path.exists() || !path.is_dir() {
        return Err(AppError::IoError(
            "The selected directory does not exist.".to_string(),
        ));
    }

    let result = if cfg!(target_os = "windows") {
        Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to open directory: {}", e)))?
    } else if cfg!(target_os = "macos") {
        Command::new("open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to open directory: {}", e)))?
    } else {
        // Linux and other Unix-like systems
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| AppError::IoError(format!("Failed to open directory: {}", e)))?
    };

    drop(result);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_derive_default_filename_from_path() {
        let filename = derive_default_filename("/path/to/video.mp4");
        assert_eq!(filename, "video-edited.mp4");
    }

    #[test]
    fn test_derive_default_filename_with_empty_source() {
        let filename = derive_default_filename("");
        assert_eq!(filename, "aetura-export-edited.mp4");
    }

    #[test]
    fn test_derive_default_filename_windows_path() {
        let filename = derive_default_filename("C:\\Videos\\myrecording.mp4");
        assert_eq!(filename, "myrecording-edited.mp4");
    }
}
