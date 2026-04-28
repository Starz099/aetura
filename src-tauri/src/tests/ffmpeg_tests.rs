use super::*;
use crate::models::{ExportFormat, ExportResolution, ExportSegment};
use crate::tests::helpers::{assert_close, with_request};

fn sample_request(format: ExportFormat) -> crate::models::ExportRequest {
    with_request(|request| {
        request.format = format;
        request.duration = 5.0;
        request.fps = 30;
    })
}

fn sample_request_with_resolution(resolution: ExportResolution) -> crate::models::ExportRequest {
    with_request(|request| {
        request.resolution = resolution;
        request.duration = 5.0;
        request.fps = 30;
    })
}

fn sample_request_with_fps(fps: u32) -> crate::models::ExportRequest {
    with_request(|request| {
        request.fps = fps;
        request.duration = 5.0;
    })
}

#[test]
fn test_hms_to_seconds_parses_fractional_seconds() {
    let seconds = hms_to_seconds("00:00:01.50").expect("expected valid timestamp");
    assert_close(seconds, 1.5);
}

#[test]
fn test_hms_to_seconds_rejects_invalid_timestamp() {
    assert!(hms_to_seconds("bad-timestamp").is_none());
    assert!(hms_to_seconds("00:00").is_none());
    assert!(hms_to_seconds("00:00:01:00").is_none());
}

#[test]
fn test_parse_ffmpeg_time_seconds_from_progress_line() {
    let line = "frame=  110 fps= 29 q=23.0 size=1024kB time=00:00:03.67 bitrate=2287.3kbits/s";
    let seconds = parse_ffmpeg_time_seconds(line).expect("expected parsed time");
    assert_close(seconds, 3.67);
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
    let seconds =
        parse_ffmpeg_time_seconds("out_time_ms=1250000").expect("expected parsed out_time_ms");
    assert_close(seconds, 1.25);
}

#[test]
fn test_parse_ffmpeg_time_seconds_from_out_time_line() {
    let seconds =
        parse_ffmpeg_time_seconds("out_time=00:00:04.20").expect("expected parsed out_time");
    assert_close(seconds, 4.2);
}

#[test]
fn test_resolve_ffmpeg_binary_returns_path() {
    let path = resolve_ffmpeg_binary();
    assert!(!path.to_string_lossy().is_empty());
}

#[test]
fn test_build_args_for_mp4_includes_h264_audio_encode() {
    let request = sample_request(ExportFormat::Mp4);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.contains(&"libx264".to_string()));
    assert!(args.contains(&"aac".to_string()));
    assert!(args.contains(&"[a0]".to_string()));
    assert!(!args.contains(&"[aconcat]".to_string()));
    assert!(args.contains(&"out.mp4".to_string()));
}

#[test]
fn test_build_args_for_gif_disables_audio_and_uses_gif_codec() {
    let request = sample_request(ExportFormat::Gif);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.gif", false);

    assert!(args.contains(&"-an".to_string()));
    assert!(args.contains(&"gif".to_string()));
    assert!(!args.contains(&"0:a?".to_string()));
    assert!(args.contains(&"out.gif".to_string()));
}

#[test]
fn test_build_args_for_720p_includes_720_scale() {
    let request = sample_request_with_resolution(ExportResolution::P720);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.iter().any(|arg| arg.contains("scale=1280:-2")));
}

#[test]
fn test_build_args_for_1080p_includes_1080_scale() {
    let request = sample_request_with_resolution(ExportResolution::P1080);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.iter().any(|arg| arg.contains("scale=1920:-2")));
}

#[test]
fn test_build_args_for_4k_includes_4k_scale() {
    let request = sample_request_with_resolution(ExportResolution::P4k);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.iter().any(|arg| arg.contains("scale=3840:-2")));
}

#[test]
fn test_build_args_for_15fps_includes_fps_filter() {
    let request = sample_request_with_fps(15);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.iter().any(|arg| arg.contains("fps=15")));
}

#[test]
fn test_build_args_for_30fps_includes_fps_filter() {
    let request = sample_request_with_fps(30);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.iter().any(|arg| arg.contains("fps=30")));
}

#[test]
fn test_build_args_for_60fps_includes_fps_filter() {
    let request = sample_request_with_fps(60);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    assert!(args.iter().any(|arg| arg.contains("fps=60")));
}

#[test]
fn test_build_args_with_background_adds_looped_input() {
    let request = with_request(|request| {
        request.background.enabled = true;
    });
    let args = build_ffmpeg_args(
        &request,
        "[0:v]null[vout]",
        Some("/tmp/aurora-1.svg"),
        "out.mp4",
        false,
    );

    assert!(args.contains(&"-loop".to_string()));
    assert!(args.contains(&"/tmp/aurora-1.svg".to_string()));
}

#[test]
fn test_build_args_with_single_segment_includes_trim_filter() {
    let request = sample_request(ExportFormat::Mp4);
    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    // Should include trim filter for the single segment
    let filter_complex = args
        .iter()
        .skip_while(|arg| *arg != "-filter_complex")
        .nth(1);
    assert!(filter_complex.is_some());
    let filter_str = filter_complex.unwrap();
    assert!(filter_str.contains("trim=start=0:end=10"));
    assert!(!filter_str.contains("concat=n=1"));
}

#[test]
fn test_build_args_with_multiple_segments_includes_concat_filter() {
    let mut request = sample_request(ExportFormat::Mp4);
    request.segments.push(ExportSegment {
        source_url: "input2.mp4".to_string(),
        in_point: 5.0,
        out_point: 15.0,
        start_on_timeline: 10.0,
    });
    request.duration = 20.0;

    let args = build_ffmpeg_args(&request, "[0:v]null[vout]", None, "out.mp4", true);

    // One source input is reused for all trims
    let input_count = args.iter().filter(|arg| *arg == "-i").count();
    assert_eq!(input_count, 1);

    let filter_complex = args
        .iter()
        .skip_while(|arg| *arg != "-filter_complex")
        .nth(1);
    assert!(filter_complex.is_some());
    let filter_str = filter_complex.unwrap();
    assert!(filter_str.contains("concat=n=2"));
    assert!(filter_str.contains("trim=start=0:end=10"));
    assert!(filter_str.contains("trim=start=5:end=15"));
}

