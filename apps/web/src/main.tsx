import { createRoot } from "react-dom/client";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router";
import { queryClient } from "./app/lib/api";
import { AuthProvider } from "./app/auth/AuthProvider";
import { ErrorBoundary } from "./app/components/ErrorBoundary";
import { router } from "./app/router";
import "./styles/index.css";

createRoot(document.getElementById("root")!).render(
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <RouterProvider router={router} />
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>,
);
