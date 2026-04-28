use super::*;

#[test]
fn test_export_segment_deserializes() {
    let value = serde_json::json!({
        "sourceUrl": "/videos/input.mp4",
        "inPoint": 5.0,
        "outPoint": 15.0,
        "startOnTimeline": 0.0
    });

    let segment: ExportSegment = serde_json::from_value(value).expect("valid segment");

    assert_eq!(segment.source_url, "/videos/input.mp4");
    assert_eq!(segment.in_point, 5.0);
    assert_eq!(segment.out_point, 15.0);
    assert_eq!(segment.start_on_timeline, 0.0);
}

#[test]
fn test_export_request_deserializes_multiple_segments() {
    let value = serde_json::json!({
        "segments": [
            {
                "sourceUrl": "/videos/input.mp4",
                "inPoint": 0.0,
                "outPoint": 10.0,
                "startOnTimeline": 0.0
            },
            {
                "sourceUrl": "/videos/input.mp4",
                "inPoint": 20.0,
                "outPoint": 30.0,
                "startOnTimeline": 10.0
            }
        ],
        "duration": 20.0,
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

    assert_eq!(request.segments.len(), 2);
    assert_eq!(request.segments[0].source_url, "/videos/input.mp4");
    assert_eq!(request.segments[0].in_point, 0.0);
    assert_eq!(request.segments[0].out_point, 10.0);
    assert_eq!(request.segments[1].in_point, 20.0);
    assert_eq!(request.duration, 20.0);
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
        "segments": [
            {
                "sourceUrl": "/videos/input.mp4",
                "inPoint": 0.0,
                "outPoint": 10.0,
                "startOnTimeline": 0.0
            }
        ],
        "duration": 10.0,
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
