import { getRouteApi } from "@tanstack/react-router";
import { EllipsisVerticalIcon, LoaderCircleIcon, PlayIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { EditorDialog } from "@/components/pixi/process/editorDialog";
import { ProcessRow } from "@/components/pixi/process/processRow";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";
import { Input } from "@/components/shadcn/input";

import {
  type Editor,
  getEditorPreference,
  openInEditor as open,
  setEditorPreference,
} from "@/lib/editor";
import { subscribe } from "@/lib/event";
import type { Task } from "@/lib/pixi/workspace/task";
import { type PtyExitEvent, type PtyStartEvent, listPtys } from "@/lib/pty";

interface EnvironmentProps {
  name: string;
  tasks: Record<string, Task>;
  filter: string;
  availableEditors: Record<string, string>;
}

export function Environment({
  name,
  tasks,
  filter,
  availableEditors,
}: EnvironmentProps) {
  const { workspace } = getRouteApi("/workspace/$path").useLoaderData();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const [commandInput, setCommandInput] = useState("");
  const [runningCommands, setRunningCommands] = useState<Map<string, string>>(
    new Map(),
  );

  // Editor
  const [lastEditor, setLastEditor] = useState<Editor | null>(null);
  const [isLaunching, setIsLaunching] = useState(false);
  const [editorDialogOpen, setEditorDialogOpen] = useState(false);

  const sortedEditors = Object.entries(availableEditors).sort(([, a], [, b]) =>
    a.localeCompare(b),
  );

  // Load saved editor preference on mount
  useEffect(() => {
    const loadPreference = async () => {
      const saved = await getEditorPreference(workspace.root, name);
      if (saved) {
        setLastEditor(saved);
      }
    };
    void loadPreference();
  }, [workspace.root, name]);

  // Load running commands on mount and subscribe to pty events to track the running freeform tasks / commands
  useEffect(() => {
    const loadRunningCommands = async () => {
      const ptys = await listPtys();
      const commands = new Map<string, string>();
      for (const pty of ptys) {
        if (
          pty.invocation.kind.kind === "command" &&
          pty.invocation.kind.environment === name
        ) {
          commands.set(pty.id, pty.invocation.kind.command);
        }
      }
      setRunningCommands(commands);
    };

    void loadRunningCommands();

    const unsubscribeStart = subscribe<PtyStartEvent>("pty-start", (event) => {
      const { kind } = event.invocation;
      if (kind.kind === "command" && kind.environment === name) {
        setRunningCommands((prev) => new Map(prev).set(event.id, kind.command));
      }
    });

    const unsubscribeExit = subscribe<PtyExitEvent>("pty-exit", (event) => {
      if (event.invocation.kind.kind === "command") {
        setRunningCommands((prev) => {
          const next = new Map(prev);
          next.delete(event.id);
          return next;
        });
      }
    });

    return () => {
      unsubscribeStart();
      unsubscribeExit();
    };
  }, [name]);

  const runFreeformTask = () => {
    if (!commandInput.trim()) return;
    navigate({
      to: "./process",
      search: {
        kind: "command",
        command: commandInput.trim(),
        environment: name,
        autoStart: true,
      },
    });
    setCommandInput("");
  };

  const openInEditor = async (command: string, editorName: string) => {
    try {
      setIsLaunching(true);
      await open(workspace.root, command, name);
      setTimeout(() => setIsLaunching(false), 3000);
    } catch (error) {
      setIsLaunching(false);
      toast.error(`Failed to open ${editorName}: ${error}`);
    }
  };

  const handleEditorButtonClick = () => {
    if (!lastEditor) {
      setEditorDialogOpen(true);
      return;
    }
    openInEditor(lastEditor.command, lastEditor.name);
  };

  const handleEditorDialogSubmit = async (editor: Editor) => {
    setLastEditor(editor);
    await setEditorPreference(workspace.root, name, editor);
    openInEditor(editor.command, editor.name);
  };

  const normalizedFilter = filter.trim().toLowerCase();

  // Filter and sort tasks
  const filteredTasks = Object.entries(tasks)
    .filter(([taskName]) =>
      taskName.trim().toLowerCase().includes(normalizedFilter),
    )
    .sort(([a], [b]) => a.localeCompare(b));

  // Filter and sort running commands
  const filteredCommands = [...runningCommands.entries()]
    .filter(([, command]) =>
      command.trim().toLowerCase().includes(normalizedFilter),
    )
    .sort(([, a], [, b]) => a.localeCompare(b));

  // Show environment if there's content or no filter is applied
  const hasContent =
    filteredTasks.length > 0 ||
    filteredCommands.length > 0 ||
    !normalizedFilter;

  if (!hasContent) {
    return null;
  }

  return (
    <PreferencesGroup
      title={
        <span className="flex items-baseline gap-pfx-s">
          <span className="inline-flex items-center rounded-full border px-2 py-0.5 font-bold text-base">
            <code>{name}</code>
          </span>
          <span>Environment</span>
        </span>
      }
      headerSuffix={
        <div className="flex flex-wrap gap-pfx-xs">
          <Badge
            variant="default"
            disabled={isLaunching}
            onClick={handleEditorButtonClick}
          >
            {isLaunching && (
              <LoaderCircleIcon className="size-3 animate-spin" />
            )}
            {lastEditor ? `Open in ${lastEditor.name}` : "Open in Editor…"}
          </Badge>
          {lastEditor && (
            <Badge variant="default" onClick={() => setEditorDialogOpen(true)}>
              <EllipsisVerticalIcon />
            </Badge>
          )}
        </div>
      }
      stickyHeader
    >
      <Input
        label="Enter a task or command to run…"
        value={commandInput}
        onChange={(e) => setCommandInput(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && runFreeformTask()}
        suffix={
          <Button
            type="button"
            size="icon"
            variant="ghost"
            title="Run command"
            disabled={!commandInput.trim()}
            onClick={runFreeformTask}
            className="mr-0.5"
          >
            <PlayIcon className="text-pfx-good" />
          </Button>
        }
      />
      {filteredCommands.map(([id, command]) => (
        <ProcessRow
          key={id}
          kind="command"
          command={command}
          environment={name}
        />
      ))}
      {filteredTasks.map(([taskName, task]) => (
        <ProcessRow
          key={taskName}
          kind="task"
          task={task}
          taskName={taskName}
          environment={name}
        />
      ))}

      {editorDialogOpen && (
        <EditorDialog
          onOpenChange={setEditorDialogOpen}
          environment={name}
          availableEditors={sortedEditors}
          onSubmit={handleEditorDialogSubmit}
        />
      )}
    </PreferencesGroup>
  );
}
