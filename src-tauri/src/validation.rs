/// Validation logic for export requests
use crate::errors::AppError;
use crate::filters;
use crate::models::{ExportEffect, ExportRequest};

/// Validate an export request
pub fn validate_request(request: &ExportRequest) -> Result<(), AppError> {
    validate_segments(&request.segments)?;
    validate_duration(request.duration)?;
    validate_effects(&request.effects, request.duration)?;
    validate_settings(request)?;
    Ok(())
}

/// Validate video segments
fn validate_segments(segments: &[crate::models::ExportSegment]) -> Result<(), AppError> {
    if segments.is_empty() {
        return Err(AppError::ValidationError(
            "At least one segment is required.".to_string(),
        ));
    }

    for (i, segment) in segments.iter().enumerate() {
        if segment.source_url.trim().is_empty() {
            return Err(AppError::ValidationError(
                format!("Segment {} source URL is missing.", i + 1),
            ));
        }

        if segment.in_point < 0.0 || segment.out_point < 0.0 {
            return Err(AppError::ValidationError(
                format!("Segment {} has invalid time points.", i + 1),
            ));
        }

        if segment.in_point >= segment.out_point {
            return Err(AppError::ValidationError(
                format!("Segment {} in-point must be before out-point.", i + 1),
            ));
        }
    }

    Ok(())
}

fn validate_settings(request: &ExportRequest) -> Result<(), AppError> {
    if !matches!(request.fps, 15 | 30 | 60) {
        return Err(AppError::ValidationError(
            "Frame rate must be one of: 15, 30, 60.".to_string(),
        ));
    }

    if request.background.padding > filters::MAX_BACKGROUND_PADDING {
        return Err(AppError::ValidationError(format!(
            "Background padding must be between 0 and {}.",
            filters::MAX_BACKGROUND_PADDING
        )));
    }

    if request.background.roundedness > filters::MAX_BACKGROUND_ROUNDEDNESS {
        return Err(AppError::ValidationError(format!(
            "Background roundedness must be between 0 and {}.",
            filters::MAX_BACKGROUND_ROUNDEDNESS
        )));
    }

    if !filters::is_supported_background_preset(&request.background.preset_id) {
        return Err(AppError::ValidationError(format!(
            "Unsupported background preset '{}'.",
            request.background.preset_id
        )));
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
#[path = "tests/validation_tests.rs"]
mod tests;
