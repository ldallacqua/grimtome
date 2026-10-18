use serde::{Serialize, Serializer};

/// Errors returned to the web UI. They serialize as a plain message string, which
/// `invoke()` surfaces as the rejection value.
#[derive(Debug, thiserror::Error)]
pub enum AppError {
    #[error("{0}")]
    Io(#[from] std::io::Error),
    #[error("{0}")]
    Data(#[from] d4data::Error),
    #[error("{0}")]
    Tauri(#[from] tauri::Error),
    #[error("{0}")]
    Image(#[from] image::ImageError),
    #[cfg(windows)]
    #[error("{0}")]
    Windows(#[from] windows::core::Error),
    #[error("{0}")]
    Message(String),
}

impl AppError {
    pub fn msg(m: impl Into<String>) -> Self {
        Self::Message(m.into())
    }
}

impl Serialize for AppError {
    fn serialize<S: Serializer>(&self, s: S) -> Result<S::Ok, S::Error> {
        s.serialize_str(&self.to_string())
    }
}

pub type AppResult<T> = Result<T, AppError>;
