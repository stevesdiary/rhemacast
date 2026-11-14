use thiserror::Error;

#[derive(Error, Debug)]
pub enum SongsError {
    #[error("Database error: {0}")]
    Database(#[from] rusqlite::Error),

    #[error("Serialization error: {0}")]
    Serialization(#[from] serde_json::Error),

    #[error("Song not found: {0}")]
    NotFound(String),

    #[error("Invalid input: {0}")]
    InvalidInput(String),
}

impl From<SongsError> for String {
    fn from(err: SongsError) -> Self {
        err.to_string()
    }
}

pub type Result<T> = std::result::Result<T, SongsError>;