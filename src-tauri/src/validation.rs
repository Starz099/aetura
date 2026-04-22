/// Validation logic for export requests
use crate::errors::AppError;
use crate::models::{ExportEffect, ExportRequest};

const ALLOWED_BACKGROUND_PRESETS: [&str; 4] = ["aurora-1", "ocean-1", "sunset-1", "night-1"];
const MAX_BACKGROUND_PADDING: u32 = 64;

/// Validate an export request
pub fn validate_request(request: &ExportRequest) -> Result<(), AppError> {
    validate_source(&request.source)?;
    validate_duration(request.duration)?;
    validate_effects(&request.effects, request.duration)?;
    validate_settings(request)?;
    Ok(())
}

fn validate_settings(request: &ExportRequest) -> Result<(), AppError> {
    if !matches!(request.fps, 15 | 30 | 60) {
        return Err(AppError::ValidationError(
            "Frame rate must be one of: 15, 30, 60.".to_string(),
        ));
    }

    if request.background.padding > MAX_BACKGROUND_PADDING {
        return Err(AppError::ValidationError(format!(
            "Background padding must be between 0 and {}.",
            MAX_BACKGROUND_PADDING
        )));
    }

    if !ALLOWED_BACKGROUND_PRESETS
        .iter()
        .any(|preset| *preset == request.background.preset_id)
    {
        return Err(AppError::ValidationError(format!(
            "Unsupported background preset '{}'.",
            request.background.preset_id
        )));
    }

    Ok(())
}

/// Validate source video path
fn validate_source(source: &str) -> Result<(), AppError> {
    if source.trim().is_empty() {
        return Err(AppError::ValidationError(
            "Source video is missing.".to_string(),
        ));
    }
    Ok(())
}

/// Validate video duration
fn validate_duration(duration: f64) -> Result<(), AppError> {
    if !duration.is_finite() || duration < 0.0 {
        return Err(AppError::ValidationError(
            "Duration must be a non-negative number.".to_string(),
        ));
    }
    Ok(())
}

/// Validate all effects in the request
fn validate_effects(effects: &[ExportEffect], duration: f64) -> Result<(), AppError> {
    for effect in effects {
        validate_effect(effect, duration)?;
    }
    Ok(())
}

/// Validate a single effect
fn validate_effect(effect: &ExportEffect, duration: f64) -> Result<(), AppError> {
    if effect.effect_type != "zoom" {
        return Err(AppError::ValidationError(format!(
            "Unsupported effect type '{}' for V1. Only 'zoom' is supported.",
            effect.effect_type
        )));
    }

    if !effect.start_time.is_finite() || effect.start_time < 0.0 {
        return Err(AppError::ValidationError(
            "Effect startTime must be non-negative.".to_string(),
        ));
    }

    if !effect.length.is_finite() || effect.length <= 0.0 {
        return Err(AppError::ValidationError(
            "Effect length must be greater than zero.".to_string(),
        ));
    }

    if !effect.multiplier.is_finite() || effect.multiplier < 1.0 {
        return Err(AppError::ValidationError(
            "Zoom multiplier must be at least 1.0.".to_string(),
        ));
    }

    if duration > 0.0 && (effect.start_time + effect.length > duration + 0.001) {
        return Err(AppError::ValidationError(
            "One or more effects exceed source duration.".to_string(),
        ));
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_validate_empty_source() {
        let request = ExportRequest {
            source: "".to_string(),
            duration: 10.0,
            effects: vec![],
            background: crate::models::ExportBackground {
                enabled: false,
                preset_id: "aurora-1".to_string(),
                padding: 32,
            },
            destination: crate::models::ExportDestination::File,
            format: crate::models::ExportFormat::Mp4,
            resolution: crate::models::ExportResolution::P1080,
            fps: 60,
            optimize_file_size: false,
        };
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn test_validate_negative_duration() {
        let request = ExportRequest {
            source: "test.mp4".to_string(),
            duration: -1.0,
            effects: vec![],
            background: crate::models::ExportBackground {
                enabled: false,
                preset_id: "aurora-1".to_string(),
                padding: 32,
            },
            destination: crate::models::ExportDestination::File,
            format: crate::models::ExportFormat::Mp4,
            resolution: crate::models::ExportResolution::P1080,
            fps: 60,
            optimize_file_size: false,
        };
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn test_validate_valid_request() {
        let request = ExportRequest {
            source: "test.mp4".to_string(),
            duration: 10.0,
            effects: vec![],
            background: crate::models::ExportBackground {
                enabled: false,
                preset_id: "aurora-1".to_string(),
                padding: 32,
            },
            destination: crate::models::ExportDestination::File,
            format: crate::models::ExportFormat::Mp4,
            resolution: crate::models::ExportResolution::P1080,
            fps: 60,
            optimize_file_size: false,
        };
        assert!(validate_request(&request).is_ok());
    }

    #[test]
    fn test_validate_invalid_fps() {
        let request = ExportRequest {
            source: "test.mp4".to_string(),
            duration: 10.0,
            effects: vec![],
            background: crate::models::ExportBackground {
                enabled: false,
                preset_id: "aurora-1".to_string(),
                padding: 32,
            },
            destination: crate::models::ExportDestination::File,
            format: crate::models::ExportFormat::Mp4,
            resolution: crate::models::ExportResolution::P1080,
            fps: 24,
            optimize_file_size: false,
        };
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn test_validate_invalid_background_preset() {
        let request = ExportRequest {
            source: "test.mp4".to_string(),
            duration: 10.0,
            effects: vec![],
            background: crate::models::ExportBackground {
                enabled: true,
                preset_id: "unknown".to_string(),
                padding: 32,
            },
            destination: crate::models::ExportDestination::File,
            format: crate::models::ExportFormat::Mp4,
            resolution: crate::models::ExportResolution::P1080,
            fps: 60,
            optimize_file_size: false,
        };
        assert!(validate_request(&request).is_err());
    }

    #[test]
    fn test_validate_invalid_background_padding() {
        let request = ExportRequest {
            source: "test.mp4".to_string(),
            duration: 10.0,
            effects: vec![],
            background: crate::models::ExportBackground {
                enabled: true,
                preset_id: "aurora-1".to_string(),
                padding: 100,
            },
            destination: crate::models::ExportDestination::File,
            format: crate::models::ExportFormat::Mp4,
            resolution: crate::models::ExportResolution::P1080,
            fps: 60,
            optimize_file_size: false,
        };
        assert!(validate_request(&request).is_err());
    }
}
