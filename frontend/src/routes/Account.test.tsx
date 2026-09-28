import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, renderWithProviders } from "../test/utils";
import type { User } from "../lib/types";

const session = vi.hoisted(() => ({
    user: null as User | null,
    logout: vi.fn(),
}));

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: session.user,
        status: "authenticated",
        login: vi.fn(),
        register: vi.fn(),
        logout: session.logout,
    }),
}));

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return {
        ...actual,
        api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
    };
});

const { api, ApiError } = await import("../lib/api");
const { Account } = await import("./Account");

const post = vi.mocked(api.post);

beforeEach(() => {
    session.user = makeUser({
        fullName: "Dana Owner",
        email: "dana@example.com",
        isEmailVerified: true,
    });
    session.logout.mockReset();
});

async function fill(
    user: ReturnType<typeof userEvent.setup>,
    { current = "Old1!", next = "New1!", confirm = "New1!" } = {},
) {
    await user.type(screen.getByLabelText("Current password"), current);
    await user.type(screen.getByLabelText("New password"), next);
    await user.type(screen.getByLabelText("Confirm new password"), confirm);
}

describe("Account", () => {
    it("shows the signed-in profile and its verification state", () => {
        renderWithProviders(<Account />);

        expect(screen.getByText("Dana Owner")).toBeInTheDocument();
        expect(screen.getByText("dana@example.com")).toBeInTheDocument();
        expect(screen.getByText("Verified")).toBeInTheDocument();
    });

    it("flags an unverified address", () => {
        session.user = makeUser({ isEmailVerified: false });
        renderWithProviders(<Account />);

        expect(screen.getByText("Not verified")).toBeInTheDocument();
    });

    it("changes the password and then signs the user out", async () => {
        post.mockResolvedValue({});
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        await fill(user);
        await user.click(
            screen.getByRole("button", { name: "Change password" }),
        );

        await waitFor(() =>
            expect(post).toHaveBeenCalledWith("/auth/change-password", {
                oldPassword: "Old1!",
                newPassword: "New1!",
            }),
        );

        // The server revokes every refresh token on a change, so the tokens
        // this tab holds are already dead -- the UI has to say so rather than
        // leave the user on a session that will fail at its next request.
        expect(await screen.findByRole("status")).toHaveTextContent(
            /Every signed-in session was ended/,
        );

        await user.click(screen.getByRole("button", { name: "Sign in again" }));
        expect(session.logout).toHaveBeenCalled();
    });

    it("will not submit a mistyped confirmation", async () => {
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        await fill(user, { confirm: "New2!" });

        expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Change password" }),
        ).toBeDisabled();
        expect(post).not.toHaveBeenCalled();
    });

    it("will not submit the current password as the new one", async () => {
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        await fill(user, { next: "Old1!", confirm: "Old1!" });

        expect(
            screen.getByText(
                "Choose a password different from the current one",
            ),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Change password" }),
        ).toBeDisabled();
    });

    it("reports a rejected current password", async () => {
        post.mockRejectedValue(new ApiError(400, "Invalid old Password"));
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        await fill(user);
        await user.click(
            screen.getByRole("button", { name: "Change password" }),
        );

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Invalid old Password",
        );
        expect(session.logout).not.toHaveBeenCalled();
    });
});
