/// FFmpeg binary management and execution
use crate::errors::AppError;
use crate::models::{ExportFormat, ExportRequest, ExportResolution};
use std::collections::VecDeque;
use std::env;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn build_ffmpeg_args(request: &ExportRequest, filter_graph: &str, output: &str) -> Vec<String> {
    let resolution_filter = match request.resolution {
        ExportResolution::P720 => "scale=1280:-2",
        ExportResolution::P1080 => "scale=1920:-2",
        ExportResolution::P4k => "scale=3840:-2",
    };
    let fps_filter = format!("fps={}", request.fps);
    let tuned_video_chain = format!(
        "{};[vout]{},{}[vfinal]",
        filter_graph, fps_filter, resolution_filter
    );

    let video_preset = if request.optimize_file_size {
        "veryslow"
    } else {
        "medium"
    };
    let video_crf = "23";

    let mut args = vec![
        "-hide_banner".to_string(),
        "-nostats".to_string(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-y".to_string(),
        "-i".to_string(),
        request.source.clone(),
        "-filter_complex".to_string(),
        tuned_video_chain,
        "-map".to_string(),
        "[vfinal]".to_string(),
    ];

    match request.format {
        ExportFormat::Gif => {
            args.extend_from_slice(&[
                "-an".to_string(),
                "-c:v".to_string(),
                "gif".to_string(),
                "-loop".to_string(),
                "0".to_string(),
            ]);
        }
        ExportFormat::Mp4 => {
            args.extend_from_slice(&[
                "-map".to_string(),
                "0:a?".to_string(),
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                video_preset.to_string(),
                "-crf".to_string(),
                video_crf.to_string(),
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
                "-c:a".to_string(),
                "copy".to_string(),
            ]);
        }
    }

    args.push(output.to_string());
    args
}

fn hms_to_seconds(raw: &str) -> Option<f64> {
    let mut parts = raw.split(':');
    let hours: f64 = parts.next()?.parse().ok()?;
    let minutes: f64 = parts.next()?.parse().ok()?;
    let seconds: f64 = parts.next()?.parse().ok()?;

    if parts.next().is_some() {
        return None;
    }

    Some((hours * 3600.0) + (minutes * 60.0) + seconds)
}

fn parse_ffmpeg_time_seconds(line: &str) -> Option<f64> {
    if let Some(raw_value) = line.strip_prefix("out_time_ms=") {
        let micros: f64 = raw_value.parse().ok()?;
        return Some(micros / 1_000_000.0);
    }

    if let Some(raw_value) = line.strip_prefix("out_time=") {
        return hms_to_seconds(raw_value);
    }

    let token = line
        .split_whitespace()
        .find(|part| part.starts_with("time="))?;
    let value = token.strip_prefix("time=")?;
    hms_to_seconds(value)
}

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
    request: &ExportRequest,
    filter_graph: &str,
    output: &str,
    mut on_progress: impl FnMut(f64),
    should_cancel: impl Fn() -> bool,
) -> Result<(), AppError> {
    let ffmpeg = resolve_ffmpeg_binary();
    let args = build_ffmpeg_args(request, filter_graph, output);

    let mut command = Command::new(&ffmpeg);
    command.args(&args);
    command.stdout(Stdio::null());
    command.stderr(Stdio::piped());

    let mut child = command.spawn().map_err(|error| {
        AppError::FFmpegError(format!(
            "Could not launch ffmpeg ({}) at {}",
            error,
            ffmpeg.to_string_lossy()
        ))
    })?;

    let stderr = child.stderr.take().ok_or_else(|| {
        AppError::FFmpegError("Could not capture ffmpeg stderr stream".to_string())
    })?;
    let mut last_stderr_lines: VecDeque<String> = VecDeque::with_capacity(12);
    let mut last_emitted_percent: i32 = -1;

    for line_result in BufReader::new(stderr).lines() {
        if should_cancel() {
            child
                .kill()
                .map_err(|error| AppError::Cancelled(format!("Could not stop ffmpeg: {}", error)))?;
            let _ = child.wait();
            return Err(AppError::Cancelled("Encoding interrupted by user".to_string()));
        }

        let line = line_result.map_err(|error| {
            AppError::FFmpegError(format!("Could not read ffmpeg output: {}", error))
        })?;

        if last_stderr_lines.len() == 12 {
            last_stderr_lines.pop_front();
        }
        last_stderr_lines.push_back(line.clone());

        if request.duration > 0.0 {
            if let Some(encoded_seconds) = parse_ffmpeg_time_seconds(&line) {
                let percent = ((encoded_seconds / request.duration as f64) * 100.0).clamp(0.0, 100.0);
                let whole_percent = percent.floor() as i32;

                if whole_percent > last_emitted_percent {
                    last_emitted_percent = whole_percent;
                    on_progress(percent);
                }
            }
        }
    }

    if should_cancel() {
        let _ = child.kill();
        let _ = child.wait();
        return Err(AppError::Cancelled("Encoding interrupted by user".to_string()));
    }

    let status = child.wait().map_err(|error| {
        AppError::FFmpegError(format!("Could not wait for ffmpeg process: {}", error))
    })?;

    if !status.success() {
        let tail = last_stderr_lines
            .into_iter()
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
    use crate::models::{
        ExportDestination, ExportEffect, ExportFormat, ExportRequest, ExportResolution,
    };

    fn sample_request(format: ExportFormat) -> ExportRequest {
        ExportRequest {
            source: "input.mp4".to_string(),
            duration: 5.0,
            effects: vec![ExportEffect {
                effect_type: "zoom".to_string(),
                start_time: 1.0,
                length: 1.0,
                multiplier: 1.2,
            }],
            destination: ExportDestination::File,
            format,
            resolution: ExportResolution::P1080,
            fps: 30,
            optimize_file_size: false,
        }
    }

    fn sample_request_with_resolution(resolution: ExportResolution) -> ExportRequest {
        let mut request = sample_request(ExportFormat::Mp4);
        request.resolution = resolution;
        request
    }

    fn sample_request_with_fps(fps: u32) -> ExportRequest {
        let mut request = sample_request(ExportFormat::Mp4);
        request.fps = fps;
        request
    }

    #[test]
    fn test_hms_to_seconds_parses_fractional_seconds() {
        let seconds = hms_to_seconds("00:00:01.50").expect("expected valid timestamp");
        assert!((seconds - 1.5).abs() < 0.0001);
    }

    #[test]
    fn test_hms_to_seconds_rejects_invalid_timestamp() {
        assert!(hms_to_seconds("bad-timestamp").is_none());
        assert!(hms_to_seconds("00:00").is_none());
        assert!(hms_to_seconds("00:00:01:00").is_none());
    }

    #[test]
    fn test_parse_ffmpeg_time_seconds_from_progress_line() {
        let line =
            "frame=  110 fps= 29 q=23.0 size=1024kB time=00:00:03.67 bitrate=2287.3kbits/s";
        let seconds = parse_ffmpeg_time_seconds(line).expect("expected parsed time");
        assert!((seconds - 3.67).abs() < 0.0001);
    }

    #[test]
    fn test_parse_ffmpeg_time_seconds_missing_time_returns_none() {
        let line = "frame=110 fps=29 bitrate=2287.3kbits/s";
        assert!(parse_ffmpeg_time_seconds(line).is_none());
    }

    #[test]
    fn test_parse_ffmpeg_time_seconds_with_invalid_time_returns_none() {
        let line = "frame=110 fps=29 time=N/A bitrate=2287.3kbits/s";
        assert!(parse_ffmpeg_time_seconds(line).is_none());
    }

    #[test]
    fn test_parse_ffmpeg_time_seconds_from_out_time_ms_line() {
        let seconds = parse_ffmpeg_time_seconds("out_time_ms=1250000").expect("expected parsed out_time_ms");
        assert!((seconds - 1.25).abs() < 0.0001);
    }

    #[test]
    fn test_parse_ffmpeg_time_seconds_from_out_time_line() {
        let seconds = parse_ffmpeg_time_seconds("out_time=00:00:04.20").expect("expected parsed out_time");
        assert!((seconds - 4.2).abs() < 0.0001);
    }

    #[test]
    fn test_resolve_ffmpeg_binary_returns_path() {
        let path = resolve_ffmpeg_binary();
        // Should at minimum return a path (not empty)
        assert!(!path.to_string_lossy().is_empty());
    }

    #[test]
    fn test_build_args_for_mp4_includes_h264_audio_copy() {
        let request = sample_request(ExportFormat::Mp4);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.contains(&"libx264".to_string()));
        assert!(args.contains(&"copy".to_string()));
        assert!(args.contains(&"0:a?".to_string()));
        assert!(args.contains(&"out.mp4".to_string()));
    }

    #[test]
    fn test_build_args_for_gif_disables_audio_and_uses_gif_codec() {
        let request = sample_request(ExportFormat::Gif);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.gif");

        assert!(args.contains(&"-an".to_string()));
        assert!(args.contains(&"gif".to_string()));
        assert!(!args.contains(&"0:a?".to_string()));
        assert!(args.contains(&"out.gif".to_string()));
    }

    #[test]
    fn test_build_args_for_720p_includes_720_scale() {
        let request = sample_request_with_resolution(ExportResolution::P720);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.iter().any(|arg| arg.contains("scale=1280:-2")));
    }

    #[test]
    fn test_build_args_for_1080p_includes_1080_scale() {
        let request = sample_request_with_resolution(ExportResolution::P1080);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.iter().any(|arg| arg.contains("scale=1920:-2")));
    }

    #[test]
    fn test_build_args_for_4k_includes_4k_scale() {
        let request = sample_request_with_resolution(ExportResolution::P4k);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.iter().any(|arg| arg.contains("scale=3840:-2")));
    }

    #[test]
    fn test_build_args_for_15fps_includes_fps_filter() {
        let request = sample_request_with_fps(15);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.iter().any(|arg| arg.contains("fps=15")));
    }

    #[test]
    fn test_build_args_for_30fps_includes_fps_filter() {
        let request = sample_request_with_fps(30);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.iter().any(|arg| arg.contains("fps=30")));
    }

    #[test]
    fn test_build_args_for_60fps_includes_fps_filter() {
        let request = sample_request_with_fps(60);
        let args = build_ffmpeg_args(&request, "[0:v]null[vout]", "out.mp4");

        assert!(args.iter().any(|arg| arg.contains("fps=60")));
    }
}
