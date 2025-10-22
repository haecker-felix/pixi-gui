import type { FormEvent } from "react";
import { useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";
import { Input } from "@/components/shadcn/input";

import type { TaskArgument } from "@/lib/pixi/workspace/task";

interface TaskArgumentsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskName: string;
  taskArguments: TaskArgument[];
  onSubmit: (values: string[]) => void;
}

export function TaskArgumentsDialog({
  open,
  onOpenChange,
  taskName,
  taskArguments,
  onSubmit,
}: TaskArgumentsDialogProps) {
  // Initialize arg values with default values
  const [argValues, setArgValues] = useState<string[]>(() =>
    taskArguments.map((argument) => argument.default ?? ""),
  );

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit(argValues);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form className="space-y-pfx-m" onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Run Task</DialogTitle>
            <DialogDescription>
              The task &quot;{taskName}&quot; requires arguments in order to be
              executed.
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup>
            {taskArguments.map((argument, index) => {
              return (
                <Input
                  key={argument.name}
                  label={argument.name}
                  value={argValues[index] ?? ""}
                  onChange={(event) => {
                    const { value } = event.target;
                    setArgValues((previous) => {
                      const updated = [...previous];
                      updated[index] = value;
                      return updated;
                    });
                  }}
                />
              );
            })}
          </PreferencesGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                onOpenChange(false);
              }}
            >
              Cancel
            </Button>
            <Button type="submit">Run</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
