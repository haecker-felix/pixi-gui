import { useSyncExternalStore } from "react";

import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";

/** Shows a message with an "OK" button. */
export function showMessage(title: string, message: string): Promise<void> {
  return new Promise((resolve) =>
    enqueue({
      kind: "message",
      title,
      message,
      okLabel: "OK",
      resolve: () => resolve(),
    }),
  );
}

/** Asks the user to confirm a message. */
export function showConfirm(
  title: string,
  message: string,
  okLabel = "OK",
  cancelLabel = "Cancel",
): Promise<boolean> {
  return new Promise((resolve) =>
    enqueue({ kind: "confirm", title, message, okLabel, cancelLabel, resolve }),
  );
}

interface DialogRequest {
  id: number;
  kind: "confirm" | "message";
  title: string;
  message: string;
  okLabel: string;
  cancelLabel?: string;
  resolve: (value: boolean) => void;
}

let nextId = 0;
let queue: DialogRequest[] = [];
const listeners = new Set<() => void>();

function enqueue(request: Omit<DialogRequest, "id">) {
  queue = [...queue, { ...request, id: nextId++ }];
  listeners.forEach((listener) => listener());
}

function dequeue() {
  queue = queue.slice(1);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function GenericDialogHost() {
  const current = useSyncExternalStore(subscribe, () => queue[0]);
  if (!current) return null;

  const close = (value: boolean) => {
    dequeue();
    current.resolve(value);
  };

  return (
    <Dialog
      key={current.id}
      open
      onOpenChange={(open) => !open && close(false)}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{current.title}</DialogTitle>
          <DialogDescription>{current.message}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          {current.kind === "confirm" && (
            <Button variant="ghost" onClick={() => close(false)}>
              {current.cancelLabel}
            </Button>
          )}
          <Button autoFocus onClick={() => close(true)}>
            {current.okLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
