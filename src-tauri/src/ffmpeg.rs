/// FFmpeg binary management and execution
use crate::errors::AppError;
use crate::models::{ExportFormat, ExportRequest, ExportResolution};
use std::collections::VecDeque;
use std::env;
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Command, Stdio};

fn build_ffmpeg_args(
    request: &ExportRequest,
    filter_graph: &str,
    background_input: Option<&str>,
    output: &str,
    has_audio: bool,
) -> Vec<String> {
    eprintln!("=== BUILD_FFMPEG_ARGS DEBUG ===");
    eprintln!("Segments count: {}", request.segments.len());
    
    let resolution_filter = match request.resolution {
        ExportResolution::P720 => "scale=1280:-2",
        ExportResolution::P1080 => "scale=1920:-2",
        ExportResolution::P4k => "scale=3840:-2",
    };
    let fps_filter = format!("fps={}", request.fps);
    let source_label = "[vconcat]";
    let video_filter_graph = filter_graph.replace("[0:v]", source_label);
    let tuned_video_chain = if request.background.enabled {
        format!("{};[vout]{}[vfinal]", video_filter_graph, fps_filter)
    } else {
        format!(
            "{};[vout]{},{}[vfinal]",
            video_filter_graph, fps_filter, resolution_filter
        )
    };

    let video_preset = if request.optimize_file_size {
        "veryslow"
    } else {
        "medium"
    };
    let video_crf = "23";
    let is_single_segment = request.segments.len() == 1;

    let mut args = vec![
        "-hide_banner".to_string(),
        "-nostats".to_string(),
        "-progress".to_string(),
        "pipe:2".to_string(),
        "-y".to_string(),
        "-i".to_string(),
        request.segments[0].source_url.clone(),
    ];

    let mut filter_parts: Vec<String> = Vec::new();
    let mut concat_inputs = Vec::with_capacity(request.segments.len());

    for (idx, segment) in request.segments.iter().enumerate() {
        eprintln!("Processing segment {}: in={}, out={}", idx, segment.in_point, segment.out_point);
        
        let video_trim = format!("vtrim{}", idx);
        filter_parts.push(format!(
            "[0:v]trim=start={}:end={}[{}];[{}]setpts=PTS-STARTPTS[v{}]",
            segment.in_point, segment.out_point, video_trim, video_trim, idx
        ));
        concat_inputs.push(format!("[v{}]", idx));

        if has_audio {
            let audio_trim = format!("atrim{}", idx);
            filter_parts.push(format!(
                "[0:a]atrim=start={}:end={}[{}];[{}]asetpts=PTS-STARTPTS[a{}]",
                segment.in_point, segment.out_point, audio_trim, audio_trim, idx
            ));
            concat_inputs[idx] = format!("[v{}][a{}]", idx, idx);
        }
    }

    let (video_source_label, audio_output_label) = if is_single_segment {
        let video_label = "[v0]".to_string();
        let audio_label = if has_audio {
            Some("[a0]".to_string())
        } else {
            None
        };

        (video_label, audio_label)
    } else {
        let concat_stream_count = if has_audio { "v=1:a=1" } else { "v=1:a=0" };
        filter_parts.push(format!(
            "{}concat=n={}:{}[vconcat]{}",
            concat_inputs.join(""),
            request.segments.len(),
            concat_stream_count,
            if has_audio { "[aconcat]" } else { "" }
        ));

        (
            "[vconcat]".to_string(),
            if has_audio {
                Some("[aconcat]".to_string())
            } else {
                None
            },
        )
    };

    if let Some(path) = background_input {
        args.extend_from_slice(&[
            "-loop".to_string(),
            "1".to_string(),
            "-i".to_string(),
            path.to_string(),
        ]);
    }

    let filter_complex = if filter_parts.is_empty() {
        tuned_video_chain.replace("[vconcat]", &video_source_label)
    } else {
        format!(
            "{};{}",
            filter_parts.join(";"),
            tuned_video_chain.replace("[vconcat]", &video_source_label)
        )
    };

    eprintln!("Generated filter_complex:\n{}", filter_complex);

    args.extend_from_slice(&[
        "-filter_complex".to_string(),
        filter_complex,
        "-map".to_string(),
        "[vfinal]".to_string(),
    ]);

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
            if let Some(audio_label) = audio_output_label {
                args.extend_from_slice(&[
                    "-map".to_string(),
                    audio_label,
                    "-c:a".to_string(),
                    "aac".to_string(),
                    "-b:a".to_string(),
                    "192k".to_string(),
                ]);
            } else {
                args.extend_from_slice(&["-an".to_string()]);
            }

            args.extend_from_slice(&[
                "-c:v".to_string(),
                "libx264".to_string(),
                "-preset".to_string(),
                video_preset.to_string(),
                "-crf".to_string(),
                video_crf.to_string(),
                "-pix_fmt".to_string(),
                "yuv420p".to_string(),
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

fn resolve_ffprobe_binary() -> PathBuf {
    if let Ok(custom_path) = env::var("AETURA_FFPROBE_PATH") {
        if !custom_path.trim().is_empty() {
            return PathBuf::from(custom_path);
        }
    }

    if let Ok(current_exe) = env::current_exe() {
        if let Some(exe_dir) = current_exe.parent() {
            let candidates = [exe_dir.join("ffprobe"), exe_dir.join("ffprobe.exe")];
            for candidate in candidates {
                if candidate.exists() {
                    return candidate;
                }
            }
        }
    }

    PathBuf::from("ffprobe")
}

fn probe_source_has_audio(source: &str) -> bool {
    let ffprobe = resolve_ffprobe_binary();
    let output = Command::new(&ffprobe)
        .args([
            "-v",
            "error",
            "-select_streams",
            "a:0",
            "-show_entries",
            "stream=index",
            "-of",
            "csv=p=0",
            source,
        ])
        .output();

    match output {
        Ok(result) => !String::from_utf8_lossy(&result.stdout).trim().is_empty(),
        Err(_) => false,
    }
}

/// Execute FFmpeg with the given arguments
pub fn execute_ffmpeg(
    request: &ExportRequest,
    filter_graph: &str,
    background_input: Option<&str>,
    output: &str,
    mut on_progress: impl FnMut(f64),
    should_cancel: impl Fn() -> bool,
) -> Result<(), AppError> {
    eprintln!("=== EXECUTE_FFMPEG DEBUG ===");
    eprintln!("Number of segments: {}", request.segments.len());
    for (idx, segment) in request.segments.iter().enumerate() {
        eprintln!(
            "  Segment {}: source={}, in_point={}, out_point={}, start_on_timeline={}",
            idx, segment.source_url, segment.in_point, segment.out_point, segment.start_on_timeline
        );
    }
    eprintln!("Export duration: {}", request.duration);
    
    let ffmpeg = resolve_ffmpeg_binary();
    let has_audio = probe_source_has_audio(&request.segments[0].source_url);
    eprintln!("Has audio: {}", has_audio);
    
    let args = build_ffmpeg_args(request, filter_graph, background_input, output, has_audio);

    eprintln!("FFmpeg args (first 20):");
    for (idx, arg) in args.iter().take(20).enumerate() {
        eprintln!("  [{}]: {}", idx, arg);
    }
    if args.len() > 20 {
        eprintln!("  ... and {} more args", args.len() - 20);
    }
    
    // Find and print the filter_complex arg
    for (idx, arg) in args.iter().enumerate() {
        if arg == "-filter_complex" && idx + 1 < args.len() {
            eprintln!("Filter complex:\n{}", args[idx + 1]);
            break;
        }
    }
    eprintln!("=== END DEBUG ===");

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
            child.kill().map_err(|error| {
                AppError::Cancelled(format!("Could not stop ffmpeg: {}", error))
            })?;
            let _ = child.wait();
            return Err(AppError::Cancelled(
                "Encoding interrupted by user".to_string(),
            ));
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
                let percent =
                    ((encoded_seconds / request.duration as f64) * 100.0).clamp(0.0, 100.0);
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
        return Err(AppError::Cancelled(
            "Encoding interrupted by user".to_string(),
        ));
    }

    let status = child.wait().map_err(|error| {
        AppError::FFmpegError(format!("Could not wait for ffmpeg process: {}", error))
    })?;

    if !status.success() {
        let tail = last_stderr_lines.into_iter().collect::<Vec<_>>().join("\n");

        return Err(AppError::FFmpegError(format!(
            "Export failed during rendering:\n{}",
            tail
        )));
    }

    Ok(())
}

#[cfg(test)]
#[path = "tests/ffmpeg_tests.rs"]
mod tests;
