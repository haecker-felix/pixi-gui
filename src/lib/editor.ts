import { invoke } from "@tauri-apps/api/core";
import { LazyStore } from "@tauri-apps/plugin-store";

export interface Editor {
  command: string;
  name: string;
}

export async function listAvailableEditors(): Promise<Record<string, string>> {
  return await invoke<Record<string, string>>("list_available_editors");
}

export async function openInEditor(
  workspace: string,
  editor: string,
  environment: string,
): Promise<void> {
  await invoke("open_in_editor", { workspace, editor: editor, environment });
}

const store = new LazyStore("editor-preferences.json");

function getKey(workspaceRoot: string, environment: string): string {
  return `${workspaceRoot}:${environment}`;
}

export async function getEditorPreference(
  workspaceRoot: string,
  environment: string,
): Promise<Editor | null> {
  const preferences =
    (await store.get<Record<string, Editor>>("editorPreferences")) ?? {};
  return preferences[getKey(workspaceRoot, environment)] ?? null;
}

export async function setEditorPreference(
  workspaceRoot: string,
  environment: string,
  editor: Editor,
): Promise<void> {
  const preferences =
    (await store.get<Record<string, Editor>>("editorPreferences")) ?? {};
  preferences[getKey(workspaceRoot, environment)] = editor;
  await store.set("editorPreferences", preferences);
  await store.save();
}
