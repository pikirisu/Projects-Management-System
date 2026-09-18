import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "./context/auth";
import { ApiError } from "./lib/api";
import { App } from "./App";
import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            /*
             * A 4xx is a decision the server already made -- unauthorised,
             * forbidden, not found -- and repeating the request cannot change
             * it. Retrying only delays the error the user needs to see. A 401
             * never reaches here anyway: the API client refreshes and retries
             * once on its own.
             */
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

const container = document.getElementById("root");
if (!container) throw new Error("#root element is missing from index.html");

createRoot(container).render(
    <StrictMode>
        <QueryClientProvider client={queryClient}>
            <BrowserRouter>
                {/* AuthProvider clears the query cache on sign-out, so it has
                    to sit inside QueryClientProvider. */}
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        </QueryClientProvider>
    </StrictMode>,
);
