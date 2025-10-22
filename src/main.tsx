import { RouterProvider, createRouter } from "@tanstack/react-router";
import { attachConsole } from "@tauri-apps/plugin-log";
import { StrictMode } from "react";
import ReactDOM from "react-dom/client";

import { Toaster } from "@/components/shadcn/sonner";

// Import the generated route tree
import { routeTree } from "./routeTree.gen";

// Create a new router instance
const router = createRouter({
  routeTree,
  context: {},
  defaultPreload: "intent",
  scrollRestoration: true,
  defaultStructuralSharing: true,
  defaultPreloadStaleTime: 0,
});

// Register the router instance for type safety
declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

// Forward Rust logging to console
attachConsole().catch(console.error);

// Render the app
const rootElement = document.getElementById("app");
if (rootElement && !rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <RouterProvider router={router} />
      <Toaster />
    </StrictMode>,
  );
}
