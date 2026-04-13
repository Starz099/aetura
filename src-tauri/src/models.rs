/// Data models for export functionality
use serde::{Deserialize, Serialize};

/// Represents a single visual effect applied during export
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportEffect {
    /// Type of effect (e.g., "zoom")
    #[serde(rename = "type")]
    pub effect_type: String,
    /// Start time of effect in seconds
    pub start_time: f64,
    /// Duration of effect in seconds
    pub length: f64,
    /// Zoom multiplier (for zoom effects)
    pub multiplier: f64,
}

/// Request to export a video with effects
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    /// Path to source video file
    pub source: String,
    /// Total duration of video in seconds
    pub duration: f64,
    /// List of effects to apply
    pub effects: Vec<ExportEffect>,
}

/// Result of successful export
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// Path to output video file
    pub output_path: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_export_request_deserializes_camel_case_fields() {
        let value = serde_json::json!({
            "source": "/videos/input.mp4",
            "duration": 12.5,
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
        assert_eq!(request.effects.len(), 1);
        assert_eq!(request.effects[0].effect_type, "zoom");
        assert_eq!(request.effects[0].start_time, 1.0);
    }
}
