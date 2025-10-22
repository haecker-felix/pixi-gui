import { Link } from "@tanstack/react-router";
import { EllipsisVerticalIcon } from "lucide-react";
import { useState } from "react";

import { AboutDialog } from "@/components/common/aboutDialog";
import { Button } from "@/components/shadcn/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/shadcn/dropdown-menu";

import { openNewWindow } from "@/lib/window";

interface AppMenuProps {
  showChangeWorkspace?: boolean;
}

export function AppMenu({ showChangeWorkspace = false }: AppMenuProps) {
  const [isAboutDialogOpen, setIsAboutDialogOpen] = useState(false);

  const handleNewWindow = async () => {
    try {
      await openNewWindow();
    } catch (error) {
      console.error("Failed to open new window:", error);
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
        {showChangeWorkspace && (
          <DropdownMenuItem asChild>
            <Link to={"/"}>Change Workspace</Link>
          </DropdownMenuItem>
        )}
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
