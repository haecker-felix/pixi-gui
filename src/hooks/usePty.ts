import { useEffect, useState } from "react";

import { subscribe } from "@/lib/event";
import {
  type PtyExitEvent,
  type PtyInvocation,
  type PtyStartEvent,
  createPty,
  isPtyRunning,
  killPty,
} from "@/lib/pty";

export interface PtyState {
  isRunning: boolean;
  isStarting: boolean;
  isKilling: boolean;
  isBusy: boolean;
  start: (invocation: PtyInvocation) => Promise<void>;
  kill: () => Promise<void>;
  id: string;
}

export function usePty(options: {
  id: string;
  onStart?: (event: PtyStartEvent) => void;
  onExit?: (event: PtyExitEvent) => void;
}): PtyState {
  const { id, onStart, onExit } = options;

  const [isRunning, setIsRunning] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [isKilling, setIsKilling] = useState(false);

  const start = async (invocation: PtyInvocation) => {
    if (isStarting || isRunning) return;

    setIsStarting(true);
    try {
      await createPty(id, invocation);
      setIsRunning(true);
    } catch (error) {
      console.error("Failed to start PTY:", error);
      setIsStarting(false);
    }
  };

  const kill = async () => {
    if (isKilling || !isRunning) return;

    setIsKilling(true);
    try {
      await killPty(id);
    } catch (error) {
      console.error("Failed to kill PTY:", error);
      setIsKilling(false);
    }
  };

  useEffect(() => {
    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      if (event.id !== id) return;
      setIsRunning(true);
      setIsStarting(false);
      setIsKilling(false);
      onStart?.(event);
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
      if (event.id !== id) return;
      setIsRunning(false);
      setIsStarting(false);
      setIsKilling(false);
      onExit?.(event);
    });

    void (async () => {
      try {
        const running = await isPtyRunning(id);
        setIsRunning(running);
      } catch (error) {
        console.error("Failed to determine PTY state:", error);
      }
    })();

    return () => {
      unsubscribeStart();
      unsubscribeExit();
    };
  }, [id, onExit, onStart]);

  return {
    isRunning,
    isStarting,
    isKilling,
    isBusy: isStarting || isKilling,
    start,
    kill,
    id,
  };
}
