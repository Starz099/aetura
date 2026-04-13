/// FFmpeg binary management and execution
use crate::errors::AppError;
use std::env;
use std::path::PathBuf;
use std::process::Command;

/// Resolve the FFmpeg binary path
///
/// Searches for ffmpeg in this order:
/// 1. AETURA_FFMPEG_PATH environment variable
/// 2. Same directory as current executable
/// 3. System PATH
pub fn resolve_ffmpeg_binary() -> PathBuf {
    // Check environment variable first
    if let Ok(custom_path) = env::var("AETURA_FFMPEG_PATH") {
        if !custom_path.trim().is_empty() {
            return PathBuf::from(custom_path);
        }
    }

    // Check current executable directory
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

    // Fall back to system PATH
    PathBuf::from("ffmpeg")
}

/// Execute FFmpeg with the given arguments
pub fn execute_ffmpeg(
    source: &str,
    filter_graph: &str,
    output: &str,
) -> Result<(), AppError> {
    let ffmpeg = resolve_ffmpeg_binary();

    let ffmpeg_output = Command::new(&ffmpeg)
        .arg("-hide_banner")
        .arg("-y")
        .arg("-i")
        .arg(source)
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
        .arg(output)
        .output()
        .map_err(|error| {
            AppError::FFmpegError(format!(
                "Could not launch ffmpeg ({}) at {}",
                error,
                ffmpeg.to_string_lossy()
            ))
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

        return Err(AppError::FFmpegError(format!(
            "Export failed during rendering:\n{}",
            tail
        )));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_ffmpeg_binary_returns_path() {
        let path = resolve_ffmpeg_binary();
        // Should at minimum return a path (not empty)
        assert!(!path.to_string_lossy().is_empty());
    }
}
