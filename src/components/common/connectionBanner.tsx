import { useSyncExternalStore } from "react";

import {
  isDisconnected,
  subscribeDisconnected,
} from "@/lib/transport/websocket";

export function ConnectionBanner() {
  const disconnected = useSyncExternalStore(
    subscribeDisconnected,
    isDisconnected,
  );

  if (!disconnected) return null;

  return (
    <div className="bg-destructive px-pfx-m py-pfx-xs text-center text-sm text-white">
      Disconnected from the server, reconnecting…
    </div>
  );
}
