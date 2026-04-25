use crate::models::{
    ExportBackground, ExportDestination, ExportEffect, ExportFormat, ExportRequest,
    ExportResolution,
};

pub fn sample_effect() -> ExportEffect {
    ExportEffect {
        effect_type: "zoom".to_string(),
        start_time: 1.0,
        length: 1.0,
        multiplier: 1.2,
    }
}

pub fn sample_request() -> ExportRequest {
    ExportRequest {
        source: "input.mp4".to_string(),
        duration: 10.0,
        effects: vec![sample_effect()],
        background: ExportBackground {
            enabled: false,
            preset_id: "aurora-1".to_string(),
            padding: 32,
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
