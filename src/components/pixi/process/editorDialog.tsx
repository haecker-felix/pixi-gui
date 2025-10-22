import type { FormEvent } from "react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { SelectableRow } from "@/components/common/selectableRow";
import { Button } from "@/components/shadcn/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/shadcn/dialog";

import type { Editor } from "@/lib/editor";

interface EditorDialogProps {
  onOpenChange: (open: boolean) => void;
  environment: string;
  availableEditors: [string, string][]; // [command, name][]
  onSubmit: (editor: Editor) => void;
}

export function EditorDialog({
  onOpenChange,
  environment,
  availableEditors,
  onSubmit,
}: EditorDialogProps) {
  const [selection, setSelection] = useState<Editor | null>(null);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selection) return;

    onOpenChange(false);
    onSubmit(selection);
  };

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Open in Editor</DialogTitle>
            <DialogDescription>
              The editor is started within the &ldquo;{environment}&rdquo;
              environment.
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup placeholder="No editors found">
            {availableEditors.map(([cmd, editorName]) => (
              <SelectableRow
                key={cmd}
                prefix={<CircularIcon icon="editor" />}
                title={editorName}
                selected={selection?.command === cmd}
                onClick={() => setSelection({ command: cmd, name: editorName })}
                variant="single"
              />
            ))}
          </PreferencesGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!selection}>
              {selection ? `Open in ${selection.name}` : "Open"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
