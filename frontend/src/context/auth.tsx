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
import { api, clearTokens, getRefreshToken, setTokens } from "../lib/api";
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
    const queryClient = useQueryClient();

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
        // Otherwise the next account to sign in on this tab would briefly see
        // the previous user's cached projects.
        queryClient.clear();
    }, [queryClient]);

    const value = useMemo(
        () => ({ user, status, login, register, logout }),
        [user, status, login, register, logout],
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
