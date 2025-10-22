use std::{error::Error as StdError, fmt};

use crate::utils;

#[derive(Debug)]
pub struct Error(pub miette::Error);

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        self.0.fmt(f)
    }
}

impl StdError for Error {}

impl From<miette::Error> for Error {
    fn from(value: miette::Error) -> Self {
        Self(value)
    }
}

impl From<String> for Error {
    fn from(value: String) -> Self {
        Self(miette::miette!(value))
    }
}

impl serde::Serialize for Error {
    fn serialize<S>(&self, serializer: S) -> Result<S::Ok, S::Error>
    where
        S: serde::Serializer,
    {
        serializer.serialize_str(&utils::strip_ansi_escapes(&self.to_string()))
    }
}

impl From<Error> for String {
    fn from(value: Error) -> Self {
        value.to_string()
    }
}
