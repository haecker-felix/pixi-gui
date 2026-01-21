import { Trash2Icon } from "lucide-react";
import { useState } from "react";

import { CircularIcon } from "@/components/common/circularIcon";
import { PreferencesGroup } from "@/components/common/preferencesGroup";
import { CondaDependencyDialog } from "@/components/pixi/manifest/condaDependencyDialog";
import { PypiDependencyDialog } from "@/components/pixi/manifest/pypiDependencyDialog";
import { TaskDialog } from "@/components/pixi/tasks/taskDialog";
import { Badge } from "@/components/shadcn/badge";
import { Button } from "@/components/shadcn/button";

import type { Task } from "@/lib/pixi/workspace/task";
import {
  type Feature as FeatureData,
  type PixiPypiSpec,
  type PixiSpec,
  type Workspace,
  formatPixiSpec,
  formatPypiSpec,
  removeFeature,
} from "@/lib/pixi/workspace/workspace";

interface FeatureProps {
  feature: FeatureData;
  workspace: Workspace;
  onRemove?: () => void;
}

export function Feature({ feature, workspace, onRemove }: FeatureProps) {
  // TaskDialog
  const [isEditingTask, setIsEditingTask] = useState<{
    name: string;
    task: Task;
  } | null>(null);
  const [isAddingTask, setIsAddingTask] = useState(false);

  // CondaDependencyDialog
  const [isEditingCondaDependency, setIsEditingCondaDependency] = useState<
    [string, PixiSpec] | null
  >(null);
  const [isAddingDependency, setIsAddingDependency] = useState(false);

  // PypiDependencyDialog
  const [isEditingPypiDependency, setIsEditingPypiDependency] = useState<
    [string, PixiPypiSpec] | null
  >(null);
  const [isAddingPypiDependency, setIsAddingPypiDependency] = useState(false);

  return (
    <>
      <PreferencesGroup
        id={`feature-${feature.name}`}
        title={feature.name}
        card
        headerPrefix={<CircularIcon icon="feature" />}
        headerSuffix={
          feature.name !== "default" && (
            <Button
              size="icon"
              variant="ghost"
              title="Remove Feature"
              onClick={async () => {
                try {
                  await removeFeature(workspace.manifest, feature.name);
                  onRemove?.();
                } catch (err) {
                  console.error("Could not remove feature:", err);
                }
              }}
            >
              <Trash2Icon className="text-destructive" />
            </Button>
          )
        }
      >
        <PreferencesGroup title="Conda Dependencies" nested>
          <div className="flex flex-wrap gap-pfx-xs">
            {Object.keys(feature.dependencies)
              .sort()
              .map((depName) => {
                const specs = feature.dependencies[depName];
                return (
                  <Badge
                    key={depName}
                    title="Edit Dependency"
                    onClick={() =>
                      setIsEditingCondaDependency([depName, specs[0]])
                    }
                  >
                    {depName}
                    {formatPixiSpec(specs[0])}
                  </Badge>
                );
              })}
            <Badge
              title="Add Dependency"
              onClick={() => setIsAddingDependency(true)}
            >
              +
            </Badge>
          </div>
        </PreferencesGroup>

        <PreferencesGroup title="PyPI Dependencies" nested>
          <div className="flex flex-wrap gap-pfx-xs">
            {Object.keys(feature.pypiDependencies)
              .sort()
              .map((depName) => {
                const specs = feature.pypiDependencies[depName];
                return (
                  <Badge
                    key={depName}
                    title="Edit PyPI Dependency"
                    onClick={() =>
                      setIsEditingPypiDependency([depName, specs[0]])
                    }
                  >
                    {depName}
                    {formatPypiSpec(specs[0])}
                  </Badge>
                );
              })}
            <Badge
              title="Add PyPI Dependency"
              onClick={() => setIsAddingPypiDependency(true)}
            >
              +
            </Badge>
          </div>
        </PreferencesGroup>

        <PreferencesGroup title="Tasks" nested>
          <div className="flex flex-wrap gap-pfx-xs">
            {Object.keys(feature.tasks)
              .sort()
              .map((taskName) => (
                <Badge
                  key={taskName}
                  title="Edit Task"
                  onClick={() =>
                    setIsEditingTask({
                      name: taskName,
                      task: feature.tasks[taskName],
                    })
                  }
                >
                  {taskName}
                </Badge>
              ))}
            <Badge title="Add Task" onClick={() => setIsAddingTask(true)}>
              +
            </Badge>
          </div>
        </PreferencesGroup>
      </PreferencesGroup>

      {isEditingTask && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingTask(null)}
          workspace={workspace}
          feature={feature}
          editTask={isEditingTask.task}
          editTaskName={isEditingTask.name}
        />
      )}

      {isAddingTask && (
        <TaskDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingTask(false)}
          workspace={workspace}
          feature={feature}
        />
      )}

      {isEditingCondaDependency && (
        <CondaDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingCondaDependency(null)}
          workspace={workspace}
          feature={feature}
          editDependency={isEditingCondaDependency[0]}
          editDependencySpec={isEditingCondaDependency[1]}
        />
      )}

      {isAddingDependency && (
        <CondaDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingDependency(false)}
          workspace={workspace}
          feature={feature}
        />
      )}

      {isEditingPypiDependency && (
        <PypiDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsEditingPypiDependency(null)}
          workspace={workspace}
          feature={feature}
          editDependency={isEditingPypiDependency[0]}
          editDependencySpec={isEditingPypiDependency[1]}
        />
      )}

      {isAddingPypiDependency && (
        <PypiDependencyDialog
          open={true}
          onOpenChange={(open) => !open && setIsAddingPypiDependency(false)}
          workspace={workspace}
          feature={feature}
        />
      )}
    </>
  );
}
