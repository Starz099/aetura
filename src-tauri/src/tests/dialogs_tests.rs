use super::*;

#[test]
fn test_derive_default_filename_from_path() {
    let filename = derive_default_filename("/path/to/video.mp4", "1080p-60fps", "mp4");
    assert_eq!(filename, "video-edited-1080p-60fps.mp4");
}

#[test]
fn test_derive_default_filename_with_empty_source() {
    let filename = derive_default_filename("", "1080p-30fps", "mp4");
    assert_eq!(filename, "aetura-export-edited-1080p-30fps.mp4");
}

#[test]
fn test_derive_default_filename_windows_path() {
    let filename = derive_default_filename("C:\\Videos\\myrecording.mp4", "720p-15fps", "mp4");
    assert_eq!(filename, "myrecording-edited-720p-15fps.mp4");
}

#[test]
fn test_derive_default_filename_without_suffix() {
    let filename = derive_default_filename("/path/to/video.mp4", "", "gif");
    assert_eq!(filename, "video-edited.gif");
}
