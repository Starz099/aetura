/// FFmpeg filter building utilities
use crate::models::{ExportEffect, ExportResolution};
use std::path::PathBuf;

pub const MAX_BACKGROUND_PADDING: u32 = 64;

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
    let clamped_padding = padding.min(MAX_BACKGROUND_PADDING);
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

pub fn is_supported_background_preset(preset_id: &str) -> bool {
    background_preset_filename(preset_id).is_some()
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
#[path = "tests/filters_tests.rs"]
mod tests;
