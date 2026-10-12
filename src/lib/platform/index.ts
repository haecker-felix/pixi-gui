import { appPlatform } from "@/lib/platform/app";
import { webPlatform } from "@/lib/platform/web";
import { isTauri } from "@/lib/transport";

export const platform: Platform = isTauri ? appPlatform : webPlatform;

// Everything the frontend needs from the platform it runs on (desktop app or browser),
// apart from talking to the backend (see `@/lib/transport`).

export interface Platform {
  pickPath(options: PickPathOptions): Promise<string | null>;

  openNewWindow(): Promise<void>;
  desktopNotification(title: string, body: string): Promise<void>;

  /** Calls `handler` when the user closes the window. Closing is cancelled when it resolves to `false`. */
  onCloseRequested(handler: () => Promise<boolean>): Promise<() => void>;
}

export interface PickPathOptions {
  directory?: boolean;
  title?: string;
  defaultPath?: string;
  canCreateDirectories?: boolean;
}
