/// FFmpeg filter building utilities
use crate::models::ExportEffect;

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
}
