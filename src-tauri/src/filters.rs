/// FFmpeg filter building utilities
use crate::models::{ExportEffect, ExportResolution};
use std::path::PathBuf;

pub const MAX_BACKGROUND_PADDING: u32 = 64;
pub const MAX_BACKGROUND_ROUNDEDNESS: u32 = 32;
pub const ZOOM_TRANSITION_DURATION: f64 = 0.4;
    
fn build_rounded_alpha_expression(radius: u32) -> String {
    format!(
        "255*clip({r}+0.5-sqrt(pow(max(abs(X-(W-1)/2)-(W/2-{r})\\,0)\\,2)+pow(max(abs(Y-(H-1)/2)-(H/2-{r})\\,0)\\,2))\\,0\\,1)",
        r = radius
    )
}

/// Helper to build a smooth ramp expression (0 to 1 back to 0) for a given time window.
/// Uses a quadratic easing formula: x*x*(3-2*x)
fn build_smooth_ramp_expression(start: f64, length: f64) -> String {
    let end = start + length;
    let dur = ZOOM_TRANSITION_DURATION;

    // st(0, ...) stores the raw linear progress (min of progressIn and progressOut, capped at 1.0)
    // ld(0) loads it to apply the easing formula: ld(0)*ld(0)*(3-2*ld(0))
    // We use clip(x, 0, 1) to ensure progress stays in [0, 1] range.
    format!(
        "st(0,clip(min((t-{:.6})/{:.6},({:.6}-t)/{:.6}),0,1))*ld(0)*ld(0)*(3-2*ld(0))",
        start, dur, end, dur
    )
}


/// Build FFmpeg zoom expression from effects
pub fn build_zoom_expression(mut effects: Vec<ExportEffect>) -> String {
    effects.sort_by(|a, b| a.start_time.total_cmp(&b.start_time));

    if effects.is_empty() {
        return "1".to_string();
    }

    let mut expression = String::from("1");
    for effect in effects {
        let ramp = build_smooth_ramp_expression(effect.start_time, effect.length);
        expression.push_str(&format!(
            "+({:.6}-1)*({})",
            effect.multiplier, ramp
        ));
    }

    expression
}

fn build_zoom_anchor_expression(mut effects: Vec<ExportEffect>, axis: AnchorAxis) -> String {
    effects.sort_by(|a, b| a.start_time.total_cmp(&b.start_time));

    if effects.is_empty() {
        return "0.5".to_string();
    }

    let mut expression = String::from("0.5");
    for effect in effects {
        let anchor_value = match axis {
            AnchorAxis::X => effect.anchor.x,
            AnchorAxis::Y => effect.anchor.y,
        };
        let ramp = build_smooth_ramp_expression(effect.start_time, effect.length);
        expression.push_str(&format!(
            "+({:.6}-0.5)*({})",
            anchor_value, ramp
        ));
    }

    expression
}

enum AnchorAxis {
    X,
    Y,
}

/// Build complete FFmpeg filter graph for zoom effects
pub fn build_filter_graph(zoom_expression: &str, effects: &[ExportEffect]) -> String {
    let anchor_x = build_zoom_anchor_expression(effects.to_vec(), AnchorAxis::X);
    let anchor_y = build_zoom_anchor_expression(effects.to_vec(), AnchorAxis::Y);

    format!(
        "[0:v]split=2[base][zoomed];[zoomed]scale=w='iw*({z})':h='ih*({z})':eval=frame[scaled];[base][scaled]overlay=x='(W-w)*({ax})':y='(H-h)*({ay})'[vout]",
        z = zoom_expression,
        ax = anchor_x,
        ay = anchor_y,
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
    roundedness: u32,
    effects: &[ExportEffect],
) -> String {
    let clamped_padding = padding.min(MAX_BACKGROUND_PADDING);
    let clamped_roundedness = roundedness.min(MAX_BACKGROUND_ROUNDEDNESS);
    let max_padding_x = (output_width / 2).saturating_sub(1);
    let max_padding_y = (output_height / 2).saturating_sub(1);
    let safe_padding = clamped_padding.min(max_padding_x).min(max_padding_y);

    let inner_width = (output_width.saturating_sub(safe_padding.saturating_mul(2))).max(2);
    let inner_height = (output_height.saturating_sub(safe_padding.saturating_mul(2))).max(2);
    let max_roundedness_x = (inner_width / 2).saturating_sub(1);
    let max_roundedness_y = (inner_height / 2).saturating_sub(1);
    let safe_roundedness = clamped_roundedness
        .min(max_roundedness_x)
        .min(max_roundedness_y);
    let anchor_x = build_zoom_anchor_expression(effects.to_vec(), AnchorAxis::X);
    let anchor_y = build_zoom_anchor_expression(effects.to_vec(), AnchorAxis::Y);

    if safe_roundedness == 0 {
        return format!(
            "[0:v]split=2[base][zoomed];\
             [zoomed]scale=w='iw*({z})':h='ih*({z})':eval=frame[scaled];\
             [base][scaled]overlay=x='(W-w)*({ax})':y='(H-h)*({ay})'[zoomed_out];\
             [zoomed_out]scale=w={iw}:h={ih}:force_original_aspect_ratio=increase,crop={iw}:{ih}[fg];\
             [1:v]scale=w={ow}:h={oh}:force_original_aspect_ratio=increase,crop={ow}:{oh}[bg];\
             [bg][fg]overlay=x={p}:y={p}:shortest=1[vout]",
            z = zoom_expression,
            ax = anchor_x,
            ay = anchor_y,
            iw = inner_width,
            ih = inner_height,
            ow = output_width,
            oh = output_height,
            p = safe_padding,
        );
    }

    let alpha_expression = build_rounded_alpha_expression(safe_roundedness);

    format!(
        "[0:v]split=2[base][zoomed];\
         [zoomed]scale=w='iw*({z})':h='ih*({z})':eval=frame[scaled];\
         [base][scaled]overlay=x='(W-w)*({ax})':y='(H-h)*({ay})'[zoomed_out];\
         [zoomed_out]scale=w={iw}:h={ih}:force_original_aspect_ratio=increase,crop={iw}:{ih}[fg_base];\
         [fg_base]split=2[fg_color][fg_alpha_src];\
         [fg_color]format=rgba[fg_rgba];\
         [fg_alpha_src]format=gray,geq=lum='{aexpr}'[fg_alpha];\
         [fg_rgba][fg_alpha]alphamerge[fg];\
         [1:v]scale=w={ow}:h={oh}:force_original_aspect_ratio=increase,crop={ow}:{oh}[bg];\
         [bg][fg]overlay=x={p}:y={p}:shortest=1[vout]",
        z = zoom_expression,
        ax = anchor_x,
        ay = anchor_y,
        iw = inner_width,
        ih = inner_height,
        ow = output_width,
        oh = output_height,
        p = safe_padding,
        aexpr = alpha_expression,
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
