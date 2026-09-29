import {
    createContext,
    use,
    useCallback,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    api,
    clearTokens,
    getRefreshToken,
    onSessionLost,
    setTokens,
} from "../lib/api";
import type { AuthPayload, User } from "../lib/types";

interface AuthContextValue {
    user: User | null;
    /** "loading" only during the initial session restore. */
    status: "loading" | "authenticated" | "anonymous";
    login: (email: string, password: string) => Promise<void>;
    register: (input: {
        email: string;
        username: string;
        password: string;
        fullName?: string;
    }) => Promise<void>;
    logout: () => Promise<void>;
    /**
     * True when the session ended on its own -- expired, or revoked by a
     * password change elsewhere -- rather than because the user signed out.
     * Sign-in says so instead of leaving them to wonder why they are back here.
     */
    sessionExpired: boolean;
    /**
     * Replaces the cached user after a profile change. The header, avatars and
     * member lists all read from here, so without it a saved name would only
     * appear after a reload.
     */
    applyUser: (next: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    /*
     * Lazy initialiser, not a plain "loading". With no refresh token there is
     * nothing to restore and the answer is already known, so starting at
     * "loading" and correcting it in the effect below would render the guards'
     * full-page spinner for one frame on every visit by a signed-out user.
     */
    const [status, setStatus] = useState<AuthContextValue["status"]>(() =>
        getRefreshToken() ? "loading" : "anonymous",
    );
    const [sessionExpired, setSessionExpired] = useState(false);
    const queryClient = useQueryClient();

    /*
     * The API client discovers a dead session when a refresh is refused, which
     * can happen under any query at any time. Nothing else moves the app out of
     * the authenticated state once it is in it, so without this the guards keep
     * rendering the app shell and every panel shows its own error.
     */
    useEffect(
        () =>
            onSessionLost(() => {
                clearTokens();
                setUser(null);
                setStatus("anonymous");
                setSessionExpired(true);
                // The next account to sign in on this tab must not see these.
                queryClient.clear();
            }),
        [queryClient],
    );

    /*
     * Session restore. The access token lives in memory, so a reload always
     * starts without one -- but if a refresh token survived in localStorage,
     * this request 401s, the API client silently refreshes, and the retry
     * succeeds. No special-casing needed here beyond skipping the round trip
     * when there is nothing to refresh with.
     */
    useEffect(() => {
        let cancelled = false;

        // Already resolved to "anonymous" above; nothing to restore.
        if (!getRefreshToken()) return;

        api.get<User>("/auth/current-user")
            .then((restored) => {
                if (cancelled) return;
                setUser(restored);
                setStatus("authenticated");
            })
            .catch(() => {
                if (cancelled) return;
                clearTokens();
                setStatus("anonymous");
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const login = useCallback(async (email: string, password: string) => {
        const payload = await api.post<AuthPayload>("/auth/login", {
            email,
            password,
        });
        setTokens({
            accessToken: payload.accessToken,
            refreshToken: payload.refreshToken,
        });
        setUser(payload.user);
        setStatus("authenticated");
        setSessionExpired(false);
    }, []);

    const register = useCallback(
        async (input: {
            email: string;
            username: string;
            password: string;
            fullName?: string;
        }) => {
            // Registration does not mint tokens, so sign in straight afterwards
            // to save the user retyping what they just entered.
            await api.post("/auth/register", input);
            await login(input.email, input.password);
        },
        [login],
    );

    const logout = useCallback(async () => {
        try {
            await api.post("/auth/logout");
        } catch {
            // A failed logout call still has to clear the client: the user
            // asked to be signed out, and the tokens are ours to drop.
        }
        clearTokens();
        setUser(null);
        setStatus("anonymous");
        // Signing out is not an expiry: the sign-in screen should not tell
        // someone their session ended when they are the one who ended it.
        setSessionExpired(false);
        // Otherwise the next account to sign in on this tab would briefly see
        // the previous user's cached projects.
        queryClient.clear();
    }, [queryClient]);

    const applyUser = useCallback((next: User) => setUser(next), []);

    const value = useMemo(
        () => ({
            user,
            status,
            sessionExpired,
            login,
            register,
            logout,
            applyUser,
        }),
        [user, status, sessionExpired, login, register, logout, applyUser],
    );

    return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
    const context = use(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used inside <AuthProvider>");
    }
    return context;
}
