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

interface RegisterInput {
    email: string;
    username: string;
    password: string;
    fullName?: string;
}

interface AuthContextValue {
    user: User | null;
    /** "loading" only while a session is being restored on startup. */
    status: "loading" | "authenticated" | "anonymous";
    login: (email: string, password: string) => Promise<void>;
    register: (input: RegisterInput) => Promise<void>;
    logout: () => Promise<void>;
    /** The session ended by itself (expired or revoked), not by signing out. */
    sessionExpired: boolean;
    /** Replaces the cached user after a profile change. */
    applyUser: (next: User) => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
    const queryClient = useQueryClient();
    const [user, setUser] = useState<User | null>(null);
    // With no refresh token there is nothing to restore, so start signed out
    // rather than flash a spinner for one frame.
    const [status, setStatus] = useState<AuthContextValue["status"]>(() =>
        getRefreshToken() ? "loading" : "anonymous",
    );
    const [sessionExpired, setSessionExpired] = useState(false);

    const signOutLocally = useCallback(
        (expired: boolean) => {
            clearTokens();
            setUser(null);
            setStatus("anonymous");
            setSessionExpired(expired);
            // The next account to sign in on this tab must not see these.
            queryClient.clear();
        },
        [queryClient],
    );

    // A refused refresh can surface under any query; this is how the app
    // leaves its signed-in state and says why.
    useEffect(
        () => onSessionLost(() => signOutLocally(true)),
        [signOutLocally],
    );

    // Session restore: the access token lives in memory, so after a reload this
    // request 401s, the API client refreshes from the stored refresh token, and
    // the retry succeeds.
    useEffect(() => {
        if (!getRefreshToken()) return;
        let cancelled = false;

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
        setTokens(payload);
        setUser(payload.user);
        setStatus("authenticated");
        setSessionExpired(false);
    }, []);

    const register = useCallback(
        async (input: RegisterInput) => {
            // Registration mints no tokens, so sign straight in.
            await api.post("/auth/register", input);
            await login(input.email, input.password);
        },
        [login],
    );

    const logout = useCallback(async () => {
        try {
            await api.post("/auth/logout");
        } catch {
            // The user asked to be signed out; the tokens are ours to drop.
        }
        signOutLocally(false);
    }, [signOutLocally]);

    const value = useMemo(
        () => ({
            user,
            status,
            sessionExpired,
            login,
            register,
            logout,
            applyUser: setUser,
        }),
        [user, status, sessionExpired, login, register, logout],
    );

    return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth() {
    const context = use(AuthContext);
    if (!context) throw new Error("useAuth must be used inside <AuthProvider>");
    return context;
}
