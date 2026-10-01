import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/auth";
import { AppShell } from "./components/AppShell";
import { Spinner } from "./components/ui";
import { Account } from "./routes/Account";
import { ForgotPassword } from "./routes/ForgotPassword";
import { Login } from "./routes/Login";
import { MyTasks } from "./routes/MyTasks";
import { ProjectDetail } from "./routes/ProjectDetail";
import { Projects } from "./routes/Projects";
import { Register } from "./routes/Register";
import { ResetPassword } from "./routes/ResetPassword";
import { VerifyEmail } from "./routes/VerifyEmail";

function FullPageSpinner() {
    return (
        <div className="grid min-h-full place-items-center bg-canvas">
            <Spinner className="size-6 text-faint" />
        </div>
    );
}

// Both guards wait out "loading" instead of treating it as signed out, or a
// reload would bounce a signed-in user to /login while the session restores.
function RequireAuth({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "anonymous") return <Navigate to="/login" replace />;
    return children;
}

function SignedOutOnly({ children }: { children: ReactNode }) {
    const { status } = useAuth();
    if (status === "loading") return <FullPageSpinner />;
    if (status === "authenticated") return <Navigate to="/projects" replace />;
    return children;
}

export function App() {
    return (
        <Routes>
            <Route
                path="/login"
                element={
                    <SignedOutOnly>
                        <Login />
                    </SignedOutOnly>
                }
            />
            <Route
                path="/register"
                element={
                    <SignedOutOnly>
                        <Register />
                    </SignedOutOnly>
                }
            />
            <Route
                path="/forgot-password"
                element={
                    <SignedOutOnly>
                        <ForgotPassword />
                    </SignedOutOnly>
                }
            />

            {/*
             * Decision: the two emailed links are reachable whatever this
             * browser's session is. The token in the URL is the authorization,
             * and someone still signed in on this device is exactly who may have
             * forgotten the password they set on another one.
             */}
            <Route path="/reset-password/:token" element={<ResetPassword />} />
            <Route path="/verify-email/:token" element={<VerifyEmail />} />

            <Route
                element={
                    <RequireAuth>
                        <AppShell />
                    </RequireAuth>
                }
            >
                <Route path="/my-tasks" element={<MyTasks />} />
                <Route path="/projects" element={<Projects />} />
                <Route
                    path="/projects/:projectId"
                    element={<ProjectDetail />}
                />
                <Route path="/account" element={<Account />} />
            </Route>

            <Route path="*" element={<Navigate to="/projects" replace />} />
        </Routes>
    );
}
