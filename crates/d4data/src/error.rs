use std::path::PathBuf;

#[derive(Debug, thiserror::Error)]
pub enum Error {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),

    #[error("I/O error reading {path}: {source}")]
    IoAt {
        path: PathBuf,
        source: std::io::Error,
    },

    #[error("unsupported game data layout: {0}")]
    Layout(String),

    #[error("malformed data: {0}")]
    Format(String),

    #[error("content is encrypted; Grimtome never decrypts protected game data")]
    Encrypted,

    #[error("not found: {0}")]
    NotFound(String),

    #[error("decompression failed: {0}")]
    Decompress(String),

    #[error("image error: {0}")]
    Image(String),

    #[error("operation cancelled")]
    Cancelled,
}

pub type Result<T> = std::result::Result<T, Error>;

pub(crate) fn fmt_err(msg: impl Into<String>) -> Error {
    Error::Format(msg.into())
}
