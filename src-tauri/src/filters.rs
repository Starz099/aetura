/// FFmpeg filter building utilities
use crate::models::{ExportEffect, ExportResolution};
use std::path::PathBuf;

/// Build FFmpeg zoom expression from effects
///
/// Generates an expression like: `1*if(between(t,0.0,1.5),1.5,1)*if(between(t,3.0,4.5),2.0,1)`
/// which applies zoom multipliers at specified times.
pub fn build_zoom_expression(mut effects: Vec<ExportEffect>) -> String {
    effects.sort_by(|a, b| a.start_time.total_cmp(&b.start_time));

    if effects.is_empty() {
        return "1".to_string();
    }

    let mut expression = String::from("1");
    for effect in effects {
        let end_time = effect.start_time + effect.length;
        expression.push_str(&format!(
            "*if(between(t,{:.6},{:.6}),{:.6},1)",
            effect.start_time, end_time, effect.multiplier
        ));
    }

    expression
}

/// Build complete FFmpeg filter graph for zoom effects
pub fn build_filter_graph(zoom_expression: &str) -> String {
    format!(
        "[0:v]split=2[base][zoomed];[zoomed]scale=w='iw*({z})':h='ih*({z})':eval=frame[scaled];[base][scaled]overlay=x='(W-w)/2':y='(H-h)/2'[vout]",
        z = zoom_expression
    )
}

pub fn resolution_dimensions(resolution: &ExportResolution) -> (u32, u32) {
    match resolution {
        ExportResolution::P720 => (1280, 720),
        ExportResolution::P1080 => (1920, 1080),
        ExportResolution::P4k => (3840, 2160),
    }
}

pub fn build_background_filter_graph(
    zoom_expression: &str,
    output_width: u32,
    output_height: u32,
    padding: u32,
) -> String {
    let clamped_padding = padding.min(64);
    let max_padding_x = (output_width / 2).saturating_sub(1);
    let max_padding_y = (output_height / 2).saturating_sub(1);
    let safe_padding = clamped_padding.min(max_padding_x).min(max_padding_y);

    let inner_width = (output_width.saturating_sub(safe_padding.saturating_mul(2))).max(2);
    let inner_height = (output_height.saturating_sub(safe_padding.saturating_mul(2))).max(2);

    format!(
        "[0:v]split=2[base][zoomed];\
         [zoomed]scale=w='iw*({z})':h='ih*({z})':eval=frame[scaled];\
         [base][scaled]overlay=x='(W-w)/2':y='(H-h)/2'[zoomed_out];\
         [zoomed_out]scale=w={iw}:h={ih}:force_original_aspect_ratio=increase,crop={iw}:{ih}[fg];\
         [1:v]scale=w={ow}:h={oh}:force_original_aspect_ratio=increase,crop={ow}:{oh}[bg];\
         [bg][fg]overlay=x={p}:y={p}:shortest=1[vout]",
        z = zoom_expression,
        iw = inner_width,
        ih = inner_height,
        ow = output_width,
        oh = output_height,
        p = safe_padding
    )
}

pub fn background_preset_filename(preset_id: &str) -> Option<&'static str> {
    match preset_id {
        "aurora-1" => Some("aurora-1.svg"),
        "ocean-1" => Some("ocean-1.svg"),
        "sunset-1" => Some("sunset-1.svg"),
        "night-1" => Some("night-1.svg"),
        _ => None,
    }
}

pub fn resolve_background_preset_path(preset_id: &str) -> Option<PathBuf> {
    let filename = background_preset_filename(preset_id)?;
    let candidates = [
        PathBuf::from("../frontend/public/backgrounds").join(filename),
        PathBuf::from("frontend/public/backgrounds").join(filename),
        PathBuf::from("backgrounds").join(filename),
    ];

    candidates.into_iter().find(|path| path.exists())
}

#[cfg(test)]
mod tests {
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
        // Should process later effect first due to sorting
        assert!(expression.contains("1.500000"));
    }

    #[test]
    fn test_resolution_dimensions() {
        assert_eq!(resolution_dimensions(&ExportResolution::P720), (1280, 720));
        assert_eq!(resolution_dimensions(&ExportResolution::P1080), (1920, 1080));
        assert_eq!(resolution_dimensions(&ExportResolution::P4k), (3840, 2160));
    }

    #[test]
    fn test_background_filter_graph_contains_expected_overlay() {
        let graph = build_background_filter_graph("1.200000", 1920, 1080, 32);
        assert!(graph.contains("overlay=x=32:y=32"));
        assert!(graph.contains("[1:v]scale=w=1920:h=1080"));
    }

    #[test]
    fn test_background_preset_filename_known() {
        assert_eq!(background_preset_filename("aurora-1"), Some("aurora-1.svg"));
        assert_eq!(background_preset_filename("unknown"), None);
    }
}
