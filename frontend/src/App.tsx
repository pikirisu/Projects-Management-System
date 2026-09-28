import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/auth";
import { Layout } from "./components/Layout";
import { Login } from "./routes/Login";
import { Register } from "./routes/Register";
import { Projects } from "./routes/Projects";
import { ProjectDetail } from "./routes/ProjectDetail";
import { Spinner } from "./components/ui";

function FullPageSpinner() {
    return (
        <div className="grid min-h-full place-items-center bg-neutral-50 dark:bg-neutral-950">
            <Spinner className="size-6 text-neutral-400" />
        </div>
    );
}

/*
 * Both guards wait out the "loading" status rather than treating it as signed
 * out. Without that, every reload would bounce an authenticated user to /login
 * for the moment it takes to restore the session from the refresh token.
 */
function RequireAuth({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "anonymous") return <Navigate to="/login" replace />;
    return <>{children}</>;
}

function RedirectIfSignedIn({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "authenticated") return <Navigate to="/projects" replace />;
    return <>{children}</>;
}

export function App() {
    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <RedirectIfSignedIn>
                        <Login />
                    </RedirectIfSignedIn>
                }
            />
            <Route
                path="/register"
                element={
                    <RedirectIfSignedIn>
                        <Register />
                    </RedirectIfSignedIn>
                }
            />

            <Route
                element={
                    <RequireAuth>
                        <Layout />
                    </RequireAuth>
                }
            >
                <Route path="/projects" element={<Projects />} />
                <Route
                    path="/projects/:projectId"
                    element={<ProjectDetail />}
                />
            </Route>

            <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
    );
}
