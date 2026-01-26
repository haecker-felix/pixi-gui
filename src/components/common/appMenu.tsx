import { Link } from "@tanstack/react-router";
import { revealItemInDir } from "@tauri-apps/plugin-opener";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";

import { AboutDialog } from "@/components/common/aboutDialog";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

import { openNewWindow } from "@/lib/window";

interface AppMenuProps {
  showChangeWorkspace?: boolean;
  manifestPath?: string;
}

export function AppMenu({
  showChangeWorkspace = false,
  manifestPath,
}: AppMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  const handleNewWindow = async () => {
    try {
      await openNewWindow();
    } catch (error) {
      console.error("Failed to open new window:", error);
    }
  };

  const handleShowInExplorer = async () => {
    if (!manifestPath) return;
    try {
      await revealItemInDir(manifestPath);
    } catch (error) {
      console.error("Failed to reveal workspace in file explorer:", error);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon">
          <EllipsisVerticalIcon />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {manifestPath && (
          <DropdownMenuItem onClick={handleShowInExplorer}>
            Show in File Explorer
          </DropdownMenuItem>
        )}
        {showChangeWorkspace && (
          <DropdownMenuItem asChild>
            <Link to={"/"}>Change Workspace</Link>
          </DropdownMenuItem>
        )}
        {(manifestPath || showChangeWorkspace) && <DropdownMenuSeparator />}
        <DropdownMenuItem onClick={handleNewWindow}>
          New Window
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => setIsAboutDialogOpen(true)}>
          About Pixi GUI
        </DropdownMenuItem>
      </DropdownMenuContent>

      {isAboutDialogOpen && (
        <AboutDialog
          open={true}
          onOpenChange={(open) => !open && setIsAboutDialogOpen(false)}
        />
      )}
    </DropdownMenu>
  );
}
