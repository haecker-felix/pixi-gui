import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { PencilIcon } from "lucide-react";
import type { FormEvent } from "react";
import { useState } from "react";

import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { Row } from "@/components/common/row";
import { PlatformDialog } from "@/components/pixi/manifest/platformDialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/shadcn/select";

import { GitAttributes, ManifestFormat, init } from "@/lib/pixi/workspace/init";
import { getPlatformName } from "@/lib/utils";

interface NewWorkspaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (path: string) => void;
}

export function NewWorkspaceDialog({
  open,
  onOpenChange,
  onSuccess,
}: NewWorkspaceDialogProps) {
  const [submitError, setSubmitError] = useState("");

  const [path, setPath] = useState<string | null>(null);
  const [format, setFormat] = useState<ManifestFormat | "auto">("auto");
  const [scm, setScm] = useState<GitAttributes | "none">("none");
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [isSelectingPlatforms, setIsSelectingPlatforms] = useState(false);

  const handleSelectPath = async () => {
    setSubmitError("");
    try {
      const selectedPath = await openDialog({
        directory: true,
        canCreateDirectories: true,
      });

      if (selectedPath) {
        setPath(selectedPath);
      }
    } catch (error) {
      setSubmitError(`Failed to open directory dialog: ${error}`);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!path) return;

    setSubmitError("");

    try {
      await init({
        path: path,
        platforms: platforms,
        format: format === "auto" ? null : format,
        scm: scm === "none" ? null : scm,
      });

      onOpenChange(false);
      onSuccess?.(path);
    } catch (error) {
      setSubmitError(`Failed to create workspace: ${error}`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create New Workspace</DialogTitle>
            <DialogDescription>
              Create a new Pixi workspace in a directory.
            </DialogDescription>
          </DialogHeader>

          <PreferencesGroup nested>
            {/* Directory */}
            <Input
              label="Directory"
              type="text"
              value={path || ""}
              placeholder="Select a directory..."
              readOnly
              onClick={handleSelectPath}
            />

            {/* Platforms */}
            <Row
              title="Supported Platforms"
              subtitle={
                platforms.length > 0
                  ? [...platforms].sort().map(getPlatformName).join(", ")
                  : "Only Current Platform"
              }
              onClick={() => setIsSelectingPlatforms(true)}
              suffix={
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  onClick={() => setIsSelectingPlatforms(true)}
                >
                  <PencilIcon />
                </Button>
              }
              property
            />

            {/* Manifest */}
            <Select
              value={format as string}
              onValueChange={(value) => setFormat(value as ManifestFormat)}
            >
              <SelectTrigger label="Manifest Format">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Choose Automatically</SelectItem>
                {Object.values(ManifestFormat).map((format) => (
                  <SelectItem key={format} value={format}>
                    {format}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* SCM */}
            <Select
              value={scm as string}
              onValueChange={(value) => setScm(value as GitAttributes | "none")}
            >
              <SelectTrigger label="Code Hosting Provider">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">None</SelectItem>
                {Object.values(GitAttributes).map((scm) => (
                  <SelectItem key={scm} value={scm}>
                    {scm}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {submitError && (
              <div className="text-destructive text">{submitError}</div>
            )}
          </PreferencesGroup>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={!path}>
              Create
            </Button>
          </DialogFooter>
        </form>

        {isSelectingPlatforms && (
          <PlatformDialog
            open={true}
            onOpenChange={(open) => !open && setIsSelectingPlatforms(false)}
            platforms={platforms}
            onSelectionChange={setPlatforms}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
