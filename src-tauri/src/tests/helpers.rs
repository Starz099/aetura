use crate::models::{
    ExportBackground, ExportDestination, ExportEffect, ExportFormat, ExportRequest,
    ExportResolution, ExportSegment, ZoomAnchor,
};

pub fn sample_effect() -> ExportEffect {
    ExportEffect {
        effect_type: "zoom".to_string(),
        start_time: 1.0,
        length: 1.0,
        multiplier: 1.2,
        anchor: ZoomAnchor { x: 0.5, y: 0.5 },
    }
}

pub fn sample_segment() -> ExportSegment {
    ExportSegment {
        source_url: "input.mp4".to_string(),
        in_point: 0.0,
        out_point: 10.0,
        start_on_timeline: 0.0,
    }
}

pub fn sample_request() -> ExportRequest {
    ExportRequest {
        segments: vec![sample_segment()],
        duration: 10.0,
        effects: vec![sample_effect()],
        background: ExportBackground {
            enabled: false,
            preset_id: "aurora-1".to_string(),
            padding: 32,
            roundedness: 16,
        },
        destination: ExportDestination::File,
        format: ExportFormat::Mp4,
        resolution: ExportResolution::P1080,
        fps: 60,
        optimize_file_size: false,
    }
}

pub fn with_request(mutator: impl FnOnce(&mut ExportRequest)) -> ExportRequest {
    let mut request = sample_request();
    mutator(&mut request);
    request
}

pub fn assert_close(actual: f64, expected: f64) {
    assert!((actual - expected).abs() < 0.0001);
}
