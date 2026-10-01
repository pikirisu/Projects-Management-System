import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider } from "./context/auth";
import { ErrorBoundary } from "./components/ErrorBoundary";
import { ApiError } from "./lib/api";
import { useResolvedTheme } from "./lib/theme";
import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            // A 4xx is a decision the server already made; asking again cannot
            // change it. (A 401 is refreshed and retried by the API client.)
            retry: (failureCount, error) =>
                error instanceof ApiError &&
                error.status >= 400 &&
                error.status < 500
                    ? false
                    : failureCount < 2,
            staleTime: 30_000,
            refetchOnWindowFocus: false,
        },
    },
});

/** Toasts follow the app's theme, not just the system's. */
function ThemedToaster() {
    return (
        <Toaster
            theme={useResolvedTheme()}
            richColors
            closeButton
            position="bottom-right"
        />
    );
}

const container = document.getElementById("root");
if (!container) throw new Error("#root element is missing from index.html");

createRoot(container).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {/* Outside AuthProvider, so a throw while restoring the session is caught too. */}
                <ErrorBoundary>
                    <AuthProvider>
                        <App />
                    </AuthProvider>
                </ErrorBoundary>
                <ThemedToaster />
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
);
