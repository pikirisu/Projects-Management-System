import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, renderWithProviders } from "../test/utils";
import type { User } from "../lib/types";

const session = vi.hoisted(() => ({
    user: null as User | null,
    logout: vi.fn(),
    applyUser: vi.fn(),
}));

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: session.user,
        status: "authenticated",
        login: vi.fn(),
        register: vi.fn(),
        logout: session.logout,
        applyUser: session.applyUser,
    }),
}));

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return {
        ...actual,
        api: {
            get: vi.fn(),
            post: vi.fn(),
            put: vi.fn(),
            patch: vi.fn(),
            delete: vi.fn(),
        },
    };
});

const { api, ApiError } = await import("../lib/api");
const { Account } = await import("./Account");

const post = vi.mocked(api.post);
const patch = vi.mocked(api.patch);

beforeEach(() => {
    session.user = makeUser({
        fullName: "Dana Owner",
        email: "dana@example.com",
        isEmailVerified: true,
    });
    session.logout.mockReset();
    session.applyUser.mockReset();
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

    it("saves a new display name and updates the cached user", async () => {
        const updated = makeUser({ fullName: "Grace Hopper" });
        patch.mockResolvedValue(updated);
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        const field = screen.getByLabelText("Display name");
        expect(field).toHaveValue("Dana Owner");

        await user.clear(field);
        await user.type(field, "  Grace Hopper  ");
        await user.click(screen.getByRole("button", { name: "Save name" }));

        // Trimmed on the way out, so a stray space is not what gets stored.
        await waitFor(() =>
            expect(patch).toHaveBeenCalledWith("/auth/profile", {
                fullName: "Grace Hopper",
            }),
        );

        // The header, avatars and member lists read the cached user, so a
        // saved name that is not applied here only appears after a reload.
        expect(session.applyUser).toHaveBeenCalledWith(updated);
    });

    it("will not submit an unchanged or empty name", async () => {
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        const save = screen.getByRole("button", { name: "Save name" });
        expect(save).toBeDisabled();

        await user.clear(screen.getByLabelText("Display name"));
        expect(save).toBeDisabled();
        expect(patch).not.toHaveBeenCalled();
    });

    it("reports a rejected name", async () => {
        patch.mockRejectedValue(
            new ApiError(422, "Some of the submitted fields are invalid", {
                fullName: "Name must be 80 characters or fewer",
            }),
        );
        const user = userEvent.setup();
        renderWithProviders(<Account />);

        await user.type(screen.getByLabelText("Display name"), "x");
        await user.click(screen.getByRole("button", { name: "Save name" }));

        expect(
            await screen.findByText("Name must be 80 characters or fewer"),
        ).toBeInTheDocument();
        expect(session.applyUser).not.toHaveBeenCalled();
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
