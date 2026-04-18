/// Custom error types for Aetura Tauri application
#[derive(Debug, Clone)]
pub enum AppError {
    /// Validation error
    ValidationError(String),
    /// Dialog cancelled
    DialogCancelled(String),
    /// FFmpeg error
    FFmpegError(String),
    /// IO error
    IoError(String),
    /// Invalid request
    InvalidRequest(String),
    /// Export cancelled by user
    Cancelled(String),
}

impl AppError {
    /// Convert AppError to String for Tauri result
    pub fn message(&self) -> String {
        match self {
            AppError::ValidationError(msg) => format!("Validation error: {}", msg),
            AppError::DialogCancelled(msg) => format!("Dialog cancelled: {}", msg),
            AppError::FFmpegError(msg) => format!("FFmpeg error: {}", msg),
            AppError::IoError(msg) => format!("IO error: {}", msg),
            AppError::InvalidRequest(msg) => format!("Invalid request: {}", msg),
            AppError::Cancelled(msg) => format!("Export cancelled: {}", msg),
        }
    }
}

impl From<AppError> for String {
    fn from(error: AppError) -> Self {
        error.message()
    }
}
