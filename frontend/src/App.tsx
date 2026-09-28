import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/auth";
import { Layout } from "./components/Layout";
import { Login } from "./routes/Login";
import { Register } from "./routes/Register";
import { Projects } from "./routes/Projects";
import { ProjectDetail } from "./routes/ProjectDetail";
import { ForgotPassword } from "./routes/ForgotPassword";
import { ResetPassword } from "./routes/ResetPassword";
import { VerifyEmail } from "./routes/VerifyEmail";
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
            {/*
             * The reset link in the email is built from
             * FORGOT_PASSWORD_REDIRECT_URL + "/" + token, so this path has to
             * match that env var. Without the route the catch-all below would
             * swallow the token and bounce the user to /login.
             */}
            <Route
                path="/forgot-password"
                element={
                    <RedirectIfSignedIn>
                        <ForgotPassword />
                    </RedirectIfSignedIn>
                }
            />
            {/*
             * Not wrapped in RedirectIfSignedIn, unlike the others. A stale
             * session restored from localStorage would otherwise bounce this
             * away and discard the token -- and someone who still has a session
             * on this device is exactly the person who can have forgotten the
             * password they set on another one. The token is the authorization
             * here, not the session.
             */}
            <Route path="/reset-password/:token" element={<ResetPassword />} />

            {/*
             * Also public and also unguarded, for the same reason: the link
             * arrives by email and has to work whatever this browser's session
             * happens to be. EMAIL_VERIFICATION_REDIRECT_URL points here.
             */}
            <Route path="/verify-email/:token" element={<VerifyEmail />} />

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
