import * as tauriIpc from "@/lib/transport/tauri_ipc";
import * as websocket from "@/lib/transport/websocket";

// The only place that knows how the frontend talks to the backend

/** Whether the frontend runs in the desktop app. */
export const isTauri = "__TAURI_INTERNALS__" in window;

const transport = isTauri ? tauriIpc : websocket;

export function invoke<T>(
  cmd: string,
  args?: Record<string, unknown>,
): Promise<T> {
  return transport.invoke<T>(cmd, args);
}

export function listen<T>(
  event: string,
  handler: (payload: T) => void,
): Promise<() => void> {
  return transport.listen<T>(event, handler);
}
