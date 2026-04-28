use super::*;
use crate::tests::helpers::with_request;

#[test]
fn test_validate_empty_segments() {
    let request = with_request(|request| {
        request.segments.clear();
    });

    let error = validate_request(&request).expect_err("expected validation error");
    assert!(error
        .message()
        .contains("At least one segment is required"));
}

#[test]
fn test_validate_negative_duration() {
    let request = with_request(|request| {
        request.duration = -1.0;
    });

    let error = validate_request(&request).expect_err("expected validation error");
    assert!(error
        .message()
        .contains("Duration must be a non-negative number"));
}

#[test]
fn test_validate_valid_request() {
    let request = with_request(|request| {
        request.effects.clear();
    });

    assert!(validate_request(&request).is_ok());
}

#[test]
fn test_validate_invalid_fps() {
    let request = with_request(|request| {
        request.fps = 24;
    });

    let error = validate_request(&request).expect_err("expected validation error");
    assert!(error
        .message()
        .contains("Frame rate must be one of: 15, 30, 60"));
}

#[test]
fn test_validate_invalid_background_preset() {
    let request = with_request(|request| {
        request.background.enabled = true;
        request.background.preset_id = "unknown".to_string();
    });

    let error = validate_request(&request).expect_err("expected validation error");
    assert!(error.message().contains("Unsupported background preset"));
}

#[test]
fn test_validate_invalid_background_padding() {
    let request = with_request(|request| {
        request.background.enabled = true;
        request.background.padding = filters::MAX_BACKGROUND_PADDING + 1;
    });

    let error = validate_request(&request).expect_err("expected validation error");
    assert!(error
        .message()
        .contains("Background padding must be between 0 and"));
}

#[test]
fn test_validate_invalid_background_roundedness() {
    let request = with_request(|request| {
        request.background.enabled = true;
        request.background.roundedness = filters::MAX_BACKGROUND_ROUNDEDNESS + 1;
    });

    let error = validate_request(&request).expect_err("expected validation error");
    assert!(error
        .message()
        .contains("Background roundedness must be between 0 and"));
}
