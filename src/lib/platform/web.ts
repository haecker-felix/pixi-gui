import { showPrompt } from "@/components/common/genericDialog";

import { homeDir } from "@/lib/fs";
import type { Platform } from "@/lib/platform/index";

export const webPlatform: Platform = {
  // Browsers only hand out file contents, not paths, so the path is entered by hand
  pickPath: async ({ directory, title, defaultPath }) => {
    const path = await showPrompt(
      title ?? (directory ? "Select Folder" : "Select File"),
      "Enter a path on the server.",
      defaultPath ?? (await homeDir()),
      "Select",
    );
    return path?.trim() || null;
  },
  openNewWindow: async () => {
    window.open("/", "_blank");
  },
  desktopNotification: async (title, body) => {
    if (!("Notification" in window)) {
      return;
    }

    if (Notification.permission === "default") {
      await Notification.requestPermission();
    }

    if (Notification.permission !== "granted") {
      return;
    }

    // Only notify when the tab is not focused
    if (document.hasFocus()) {
      return;
    }

    new Notification(title, { body });
  },
  // A tab can't be kept open to ask first. The server terminates the processes
  // of the tab when its connection closes.
  onCloseRequested: async () => () => {},
};
