import { getRouteApi } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Environment } from "@/components/pixi/environments/environment";
import { Input } from "@/components/shadcn/input";

import { listAvailableEditors } from "@/lib/editor";

export function Environments() {
  const { tasks } = getRouteApi("/workspace/$path").useLoaderData();
  const { search = "" } = getRouteApi("/workspace/$path/").useSearch();
  const navigate = getRouteApi("/workspace/$path").useNavigate();

  const [availableEditors, setAvailableEditors] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    listAvailableEditors().then(setAvailableEditors).catch(console.error);
  }, []);

  const updateSearch = (value: string) => {
    navigate({
      search: (prev) => ({ ...prev, search: value }),
      replace: true,
    });
  };

  return (
    <>
      <div className="mt-pfx-m">
        <Input
          value={search}
          onChange={(event) => updateSearch(event.target.value)}
          placeholder="Search in environments…"
          autoComplete="off"
          spellCheck={false}
          autoCorrect="off"
          autoFocus={true}
        />
      </div>
      {Object.entries(tasks)
        .sort(([a], [b]) => {
          // Ensure that the default environment is always the first one
          if (a === "default" && b !== "default") return -1;
          if (b === "default" && a !== "default") return 1;
          return a.localeCompare(b);
        })
        .map(([environmentName, envTasks]) => {
          return (
            <Environment
              key={environmentName}
              name={environmentName}
              tasks={envTasks}
              filter={search}
              availableEditors={availableEditors}
            />
          );
        })}
    </>
  );
}
