use super::*;

#[test]
fn test_empty_effects_returns_identity() {
    let expression = build_zoom_expression(vec![]);
    assert_eq!(expression, "1");
}

#[test]
fn test_single_effect() {
    let effects = vec![ExportEffect {
        effect_type: "zoom".to_string(),
        start_time: 0.0,
        length: 2.0,
        multiplier: 1.5,
    }];
    let expression = build_zoom_expression(effects);
    assert!(expression.contains("1.500000"));
    assert!(expression.contains("between(t,0.000000,2.000000)"));
}

#[test]
fn test_effects_sorted_by_start_time() {
    let effects = vec![
        ExportEffect {
            effect_type: "zoom".to_string(),
            start_time: 5.0,
            length: 1.0,
            multiplier: 2.0,
        },
        ExportEffect {
            effect_type: "zoom".to_string(),
            start_time: 1.0,
            length: 1.0,
            multiplier: 1.5,
        },
    ];
    let expression = build_zoom_expression(effects);

    let early = expression
        .find("between(t,1.000000,2.000000),1.500000")
        .expect("expected early effect segment");
    let late = expression
        .find("between(t,5.000000,6.000000),2.000000")
        .expect("expected late effect segment");

    assert!(early < late);
}

#[test]
fn test_resolution_dimensions() {
    assert_eq!(resolution_dimensions(&ExportResolution::P720), (1280, 720));
    assert_eq!(
        resolution_dimensions(&ExportResolution::P1080),
        (1920, 1080)
    );
    assert_eq!(resolution_dimensions(&ExportResolution::P4k), (3840, 2160));
}

#[test]
fn test_background_filter_graph_contains_expected_overlay() {
    let graph = build_background_filter_graph("1.200000", 1920, 1080, 32, 0);
    assert!(graph.contains("overlay=x=32:y=32"));
    assert!(graph.contains("[1:v]scale=w=1920:h=1080"));
}

#[test]
fn test_background_filter_graph_clamps_padding() {
    let graph =
        build_background_filter_graph("1.200000", 1920, 1080, MAX_BACKGROUND_PADDING + 20, 0);
    assert!(graph.contains("overlay=x=64:y=64"));
}

#[test]
fn test_background_filter_graph_with_roundedness_adds_alpha_masking() {
    let graph = build_background_filter_graph("1.200000", 1920, 1080, 32, 16);
    assert!(graph.contains("alphamerge"));
    assert!(graph.contains("geq=lum='255*clip("));
}

#[test]
fn test_background_filter_graph_clamps_roundedness() {
    let graph = build_background_filter_graph(
        "1.200000",
        1920,
        1080,
        32,
        MAX_BACKGROUND_ROUNDEDNESS + 100,
    );
    assert!(graph.contains("W/2-32"));
}

#[test]
fn test_background_preset_filename_known() {
    assert_eq!(background_preset_filename("aurora-1"), Some("aurora-1.svg"));
    assert_eq!(background_preset_filename("unknown"), None);
}

#[test]
fn test_is_supported_background_preset() {
    assert!(is_supported_background_preset("night-1"));
    assert!(!is_supported_background_preset("missing"));
}
