import { CheckIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";

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
import { Input } from "@/components/shadcn/input";
import { Spinner } from "@/components/shadcn/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/shadcn/tooltip";

import {
  type RepoDataRecord,
  getRepoDataRecordId,
  searchExact,
} from "@/lib/pixi/workspace/search";

export type PackageType = "conda" | "pypi";

export type PackageVersion =
  | { type: "specific"; value: string } // A concrete version string
  | { type: "auto" } // Automatically choose highest compatible version
  | { type: "non-editable" }; // Everything else which is not a editable version string

interface DependencyVersionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceRoot: string;
  packageName: string;
  packageVersion: PackageVersion;
  packageType: PackageType;
  onSelect: (versionState: PackageVersion) => void;
}

export function DependencyVersionDialog({
  open,
  onOpenChange,
  workspaceRoot,
  packageName,
  packageVersion,
  packageType,
  onSelect,
}: DependencyVersionDialogProps) {
  const [availableVersions, setAvailableVersions] = useState<RepoDataRecord[]>(
    [],
  );
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [versionState, setVersionState] =
    useState<PackageVersion>(packageVersion);
  const [inputValue, setInputValue] = useState(
    packageVersion.type === "specific" ? packageVersion.value : "",
  );
  const [inputFocused, setInputFocused] = useState(false);

  // Load available versions when dialog opens
  useEffect(() => {
    // Don't search for conda packages when we're selecting a version for a pypi package
    if (packageType === "pypi") {
      return;
    }

    const loadVersions = async () => {
      setIsLoading(true);
      setError("");

      try {
        const results = await searchExact(workspaceRoot, { name: packageName });
        if (results) {
          // Group by version and keep only the latest build for each version
          const versionMap = new Map<string, RepoDataRecord>();

          for (const record of results) {
            const existing = versionMap.get(record.version);
            if (!existing || record.build_number > existing.build_number) {
              versionMap.set(record.version, record);
            }
          }

          const uniqueVersions = Array.from(versionMap.values()).reverse();
          setAvailableVersions(uniqueVersions);

          // Clear input if current version is in the list
          if (
            packageVersion.type === "specific" &&
            uniqueVersions.some(
              (record) => `==${record.version}` === packageVersion.value,
            )
          ) {
            setInputValue("");
          }
        }
      } catch (err) {
        setError(`Failed to load versions: ${err}`);
      } finally {
        setIsLoading(false);
      }
    };

    void loadVersions();
  }, [workspaceRoot, packageName, packageType, packageVersion]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Fallback to auto if specific version is empty
    if (versionState.type === "specific" && !versionState.value.trim()) {
      onSelect({ type: "auto" });
    } else {
      onSelect(versionState);
    }
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Select Version for {packageName}</DialogTitle>
            <DialogDescription>
              Choose a version constraint for this dependency.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-[60vh] overflow-y-auto space-y-pfx-xs">
            {/* Choose Automatically */}
            <SelectableRow
              title="Choose Automatically"
              subtitle="Use highest compatible version"
              selected={versionState.type === "auto"}
              onClick={() => setVersionState({ type: "auto" })}
              variant="single"
            />

            {/* Specific Version Input */}
            <Tooltip open={inputFocused}>
              <TooltipTrigger asChild>
                <Input
                  label="Specific Version"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setVersionState({
                      type: "specific",
                      value: e.target.value,
                    });
                  }}
                  onFocus={() => {
                    setInputFocused(true);
                    setVersionState({ type: "specific", value: inputValue });
                  }}
                  onBlur={() => setInputFocused(false)}
                  placeholder="e.g., >=1.0.0, <2.0.0"
                  suffix={
                    versionState.type === "specific" &&
                    !availableVersions.some(
                      (record) => `==${record.version}` === versionState.value,
                    ) && <CheckIcon className="text-pfx-good" />
                  }
                />
              </TooltipTrigger>
              <TooltipContent side="right">
                <p>Exact Version</p>
                <code>==4.0</code>
                <p className="mt-2">Version Range</p>
                <code>&gt;=2.0,&lt;3.0</code>
                <a
                  href="https://packaging.python.org/en/latest/specifications/version-specifiers/#id5"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline mt-2 block"
                >
                  Learn More
                </a>
              </TooltipContent>
            </Tooltip>

            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-pfx-m">
                <Spinner className="h-8 w-8" />
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="px-pfx-m py-pfx-s text-destructive text-sm">
                {error}
              </div>
            )}

            {/* Available Versions */}
            {availableVersions.map((record) => {
              const versionSpec = `==${record.version}`;
              const isSelected =
                versionState.type === "specific" &&
                versionState.value === versionSpec;

              return (
                <SelectableRow
                  key={getRepoDataRecordId(record)}
                  title={versionSpec}
                  subtitle={`Build ${record.build} (${record.build_number})`}
                  selected={isSelected}
                  onClick={() => {
                    setInputValue("");
                    setVersionState({
                      type: "specific",
                      value: versionSpec,
                    });
                  }}
                  variant="single"
                />
              );
            })}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit">Confirm</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
