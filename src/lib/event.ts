import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";

type EventHandler<T = unknown> = (payload: T) => void;

interface EventEntry {
  eventName: string;
  handlers: Set<EventHandler>;
}

const registry = new Map<string, EventEntry>();

export function subscribe<T = unknown>(
  eventName: string,
  handler: EventHandler<T>,
): () => void {
  const entry = getEntry(eventName);
  entry.handlers.add(handler as EventHandler);

  return () => {
    const entry = registry.get(eventName);
    if (!entry) return;

    entry.handlers.delete(handler as EventHandler);
  };
}

function getEntry(eventName: string): EventEntry {
  const entry = registry.get(eventName);
  if (entry) return entry;

  // Entry doesn't exist yet -> create one
  const newEntry = {
    eventName,
    handlers: new Set<EventHandler>(),
  };

  // Setup Tauri event listener
  getCurrentWebviewWindow()
    .listen(eventName, (event) => {
      const handlers = Array.from(newEntry.handlers);
      for (const handler of handlers) {
        handler(event.payload);
      }
    })
    .catch((error) => {
      console.error(`Failed to register listener for "${eventName}":`, error);
    });

  // Add entry to registry
  registry.set(eventName, newEntry);

  return newEntry;
}
