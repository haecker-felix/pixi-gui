import { invoke } from "@tauri-apps/api/core";

export async function getPixiVersion(): Promise<string> {
  return invoke<string>("pixi_version");
}

export async function getAppVersion(): Promise<string> {
  return invoke<string>("app_version");
}
