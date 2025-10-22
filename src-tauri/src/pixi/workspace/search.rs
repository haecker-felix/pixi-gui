use std::path::PathBuf;

use crate::{
    error::Error,
    utils::{self},
};
use miette::{Context, IntoDiagnostic};
use pixi_api::{
    manifest::FeaturesExt,
    rattler_conda_types::{MatchSpec, Platform, RepoDataRecord},
};
use tauri::{Runtime, Window};

#[tauri::command]
pub async fn search_wildcard<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    package_name_filter: &str,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let ctx = utils::workspace_context(window, workspace)?;

    let channels = ctx
        .workspace()
        .default_environment()
        .channels()
        .into_iter()
        .cloned()
        .map(|channel| channel.into_channel(&ctx.workspace().channel_config()))
        .collect::<Result<_, _>>()
        .into_diagnostic()
        .wrap_err("Failed to parse channels")?;

    Ok(ctx
        .search_wildcard(package_name_filter, channels, Platform::current())
        .await?)
}

#[tauri::command]
pub async fn search_exact<R: Runtime>(
    window: Window<R>,
    workspace: PathBuf,
    match_spec: MatchSpec,
) -> Result<Option<Vec<RepoDataRecord>>, Error> {
    let ctx = utils::workspace_context(window, workspace)?;

    let channels = ctx
        .workspace()
        .default_environment()
        .channels()
        .into_iter()
        .cloned()
        .map(|channel| channel.into_channel(&ctx.workspace().channel_config()))
        .collect::<Result<_, _>>()
        .into_diagnostic()
        .wrap_err("Failed to parse channels")?;

    Ok(ctx
        .search_exact(match_spec, channels, Platform::current())
        .await?)
}
