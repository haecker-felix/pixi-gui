//! Backend of Pixi GUI, independent of the frontend's transport (Tauri IPC or HTTP).

#![allow(unused_variables)]

pub mod editor;
pub mod error;
pub mod frontend;
pub mod pixi;
pub mod pty;
pub mod router;
pub mod state;
pub mod utils;
pub mod watcher;

pub use frontend::{Ctx, Frontend, SessionId};
pub use router::{DispatchError, dispatch};
pub use state::State;
