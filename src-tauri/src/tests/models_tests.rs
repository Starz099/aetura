use super::*;

#[test]
fn test_export_request_deserializes_camel_case_fields() {
    let value = serde_json::json!({
        "source": "/videos/input.mp4",
        "duration": 12.5,
        "destination": "file",
        "format": "mp4",
        "resolution": "1080p",
        "fps": 60,
        "optimizeFileSize": false,
        "effects": [
            {
                "type": "zoom",
                "startTime": 1.0,
                "length": 2.5,
                "multiplier": 1.5
            }
        ]
    });

    let request: ExportRequest = serde_json::from_value(value).expect("valid export request");

    assert_eq!(request.source, "/videos/input.mp4");
    assert_eq!(request.duration, 12.5);
    assert_eq!(request.destination, ExportDestination::File);
    assert_eq!(request.format, ExportFormat::Mp4);
    assert_eq!(request.resolution, ExportResolution::P1080);
    assert_eq!(request.fps, 60);
    assert!(!request.optimize_file_size);
    assert_eq!(request.effects.len(), 1);
    assert_eq!(request.effects[0].effect_type, "zoom");
    assert_eq!(request.effects[0].start_time, 1.0);
    assert!(!request.background.enabled);
    assert_eq!(request.background.preset_id, "aurora-1");
    assert_eq!(request.background.padding, 32);
    assert_eq!(request.background.roundedness, 16);
}

#[test]
fn test_export_request_deserializes_background_fields() {
    let value = serde_json::json!({
        "source": "/videos/input.mp4",
        "duration": 12.5,
        "effects": [],
        "background": {
            "enabled": true,
            "presetId": "ocean-1",
            "padding": 12,
            "roundedness": 10
        }
    });

    let request: ExportRequest = serde_json::from_value(value).expect("valid export request");

    assert!(request.background.enabled);
    assert_eq!(request.background.preset_id, "ocean-1");
    assert_eq!(request.background.padding, 12);
    assert_eq!(request.background.roundedness, 10);
}
