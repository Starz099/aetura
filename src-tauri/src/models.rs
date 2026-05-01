/// Data models for export functionality
use crate::constants::*;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportDestination {
    File,
    Clipboard,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Mp4,
    Gif,
}

#[derive(Debug, Clone, Deserialize, PartialEq, Eq)]
pub enum ExportResolution {
    #[serde(rename = "720p")]
    P720,
    #[serde(rename = "1080p")]
    P1080,
    #[serde(rename = "4k")]
    P4k,
}

fn default_destination() -> ExportDestination {
    ExportDestination::File
}

fn default_format() -> ExportFormat {
    ExportFormat::Mp4
}

fn default_resolution() -> ExportResolution {
    ExportResolution::P1080
}

fn default_fps() -> u32 {
    DEFAULT_FPS
}
fn default_optimize_file_size() -> bool {
    DEFAULT_OPTIMIZE_FILE_SIZE
}

fn default_zoom_anchor_x() -> f64 {
    DEFAULT_ZOOM_ANCHOR_X
}

fn default_zoom_anchor_y() -> f64 {
    DEFAULT_ZOOM_ANCHOR_Y
}

fn default_zoom_anchor() -> ZoomAnchor {
    ZoomAnchor {
        x: default_zoom_anchor_x(),
        y: default_zoom_anchor_y(),
    }
}

fn default_background_enabled() -> bool {
    DEFAULT_BACKGROUND_ENABLED
}

fn default_background_preset_id() -> String {
    DEFAULT_BACKGROUND_PRESET_ID.to_string()
}

fn default_background_padding() -> u32 {
    DEFAULT_BACKGROUND_PADDING
}

fn default_background_roundedness() -> u32 {
    DEFAULT_BACKGROUND_ROUNDEDNESS
}
/// Background settings applied during export.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportBackground {
    #[serde(default = "default_background_enabled")]
    pub enabled: bool,
    #[serde(default = "default_background_preset_id")]
    pub preset_id: String,
    #[serde(default = "default_background_padding")]
    pub padding: u32,
    #[serde(default = "default_background_roundedness")]
    pub roundedness: u32,
}

/// Normalized anchor position for a zoom effect.
#[derive(Debug, Clone, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
pub struct ZoomAnchor {
    #[serde(default = "default_zoom_anchor_x")]
    pub x: f64,
    #[serde(default = "default_zoom_anchor_y")]
    pub y: f64,
}

fn default_background() -> ExportBackground {
    ExportBackground {
        enabled: default_background_enabled(),
        preset_id: default_background_preset_id(),
        padding: default_background_padding(),
        roundedness: default_background_roundedness(),
    }
}

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
    /// Normalized zoom anchor position (0.0 to 1.0 on each axis)
    #[serde(default = "default_zoom_anchor")]
    pub anchor: ZoomAnchor,
}

/// Represents a single video segment/clip to export
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportSegment {
    /// Path to source video file
    pub source_url: String,
    /// Start time in source video (in seconds)
    pub in_point: f64,
    /// End time in source video (in seconds)
    pub out_point: f64,
    /// Start time in timeline/output (in seconds)
    pub start_on_timeline: f64,
}

/// Request to export a video with effects
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportRequest {
    /// Video segments to concatenate and export
    pub segments: Vec<ExportSegment>,
    /// Total duration of concatenated video in seconds (used for progress calculation)
    pub duration: f64,
    /// List of effects to apply
    pub effects: Vec<ExportEffect>,
    /// Global background styling settings
    #[serde(default = "default_background")]
    pub background: ExportBackground,
    /// Export destination mode
    #[serde(default = "default_destination")]
    pub destination: ExportDestination,
    /// Output format
    #[serde(default = "default_format")]
    pub format: ExportFormat,
    /// Target resolution
    #[serde(default = "default_resolution")]
    pub resolution: ExportResolution,
    /// Target frame rate
    #[serde(default = "default_fps")]
    pub fps: u32,
    /// Slower encode for smaller file size
    #[serde(default = "default_optimize_file_size")]
    pub optimize_file_size: bool,
}

/// Result of successful export
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    /// Path to output video file
    pub output_path: String,
}

/// Export lifecycle event payload emitted to the frontend.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportStatusEvent {
    pub kind: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub progress_percent: Option<f64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output_path: Option<String>,
}

impl ExportStatusEvent {
    pub fn started() -> Self {
        Self {
            kind: "started".to_string(),
            progress_percent: Some(0.0),
            message: Some("Preparing export...".to_string()),
            output_path: None,
        }
    }

    pub fn progress(progress_percent: f64) -> Self {
        Self {
            kind: "progress".to_string(),
            progress_percent: Some(progress_percent),
            message: None,
            output_path: None,
        }
    }

    pub fn completed(output_path: String) -> Self {
        Self {
            kind: "completed".to_string(),
            progress_percent: Some(100.0),
            message: Some("Export completed".to_string()),
            output_path: Some(output_path),
        }
    }

    pub fn failed(message: String) -> Self {
        Self {
            kind: "failed".to_string(),
            progress_percent: None,
            message: Some(message),
            output_path: None,
        }
    }

    pub fn cancelled(message: String) -> Self {
        Self {
            kind: "cancelled".to_string(),
            progress_percent: None,
            message: Some(message),
            output_path: None,
        }
    }
}

#[cfg(test)]
#[path = "tests/models_tests.rs"]
mod tests;
