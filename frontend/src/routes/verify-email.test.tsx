import { Route, Routes } from "react-router-dom";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { makeUser, renderWithProviders } from "../test/utils";
import type { User } from "../lib/types";

const session = vi.hoisted(() => ({
    user: null as User | null,
    status: "anonymous" as "loading" | "authenticated" | "anonymous",
}));

vi.mock("../context/auth", () => ({
    useAuth: () => ({
        user: session.user,
        status: session.status,
        login: vi.fn(),
        register: vi.fn(),
        logout: vi.fn(),
    }),
}));

vi.mock("../lib/api", async (importOriginal) => {
    const actual = await importOriginal<typeof import("../lib/api")>();
    return {
        ...actual,
        api: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
        pingApi: vi.fn().mockResolvedValue(true),
    };
});

const { api, ApiError } = await import("../lib/api");
const { VerifyEmail } = await import("./VerifyEmail");
const { VerifyEmailBanner } = await import("../components/VerifyEmailBanner");

const get = vi.mocked(api.get);
const post = vi.mocked(api.post);

beforeEach(() => {
    session.user = null;
    session.status = "anonymous";
});

function renderVerify(token = "tok-1") {
    return renderWithProviders(
        <Routes>
            <Route path="/verify-email/:token" element={<VerifyEmail />} />
        </Routes>,
        { route: `/verify-email/${token}` },
    );
}

describe("VerifyEmail", () => {
    it("calls the endpoint with the token from the link", async () => {
        get.mockResolvedValue({ isEmailVerified: true });
        renderVerify("abc123");

        await waitFor(() =>
            expect(get).toHaveBeenCalledWith("/auth/verify-email/abc123"),
        );
        expect(
            await screen.findByRole("heading", { name: "Email verified" }),
        ).toBeInTheDocument();
    });

    it("explains an expired link rather than showing raw JSON", async () => {
        get.mockRejectedValue(new ApiError(400, "Token is invalid or expired"));
        renderVerify();

        expect(await screen.findByRole("alert")).toHaveTextContent(
            "Token is invalid or expired",
        );
        expect(
            screen.getByRole("heading", { name: "That link did not work" }),
        ).toBeInTheDocument();
    });
});

describe("VerifyEmailBanner", () => {
    it("stays out of the way for a verified account", () => {
        session.user = makeUser({ isEmailVerified: true });
        session.status = "authenticated";
        const { container } = renderWithProviders(<VerifyEmailBanner />);

        expect(container).toBeEmptyDOMElement();
    });

    it("is absent when the field was not projected at all", () => {
        // Several endpoints omit isEmailVerified; absent must not be read as
        // unverified, or every user would see the banner.
        session.user = makeUser();
        session.status = "authenticated";
        const { container } = renderWithProviders(<VerifyEmailBanner />);

        expect(container).toBeEmptyDOMElement();
    });

    it("offers an unverified account a fresh link", async () => {
        session.user = makeUser({
            isEmailVerified: false,
            email: "dana@example.com",
        });
        session.status = "authenticated";
        post.mockResolvedValue({});
        const user = userEvent.setup();
        renderWithProviders(<VerifyEmailBanner />);

        expect(screen.getByRole("status")).toHaveTextContent(
            /not verified yet/,
        );
        await user.click(screen.getByRole("button", { name: "Resend link" }));

        await waitFor(() =>
            expect(post).toHaveBeenCalledWith(
                "/auth/resend-email-verification",
            ),
        );
        expect(await screen.findByRole("status")).toHaveTextContent(
            /on its way to dana@example\.com/,
        );
    });

    it("shows why a resend failed", async () => {
        session.user = makeUser({ isEmailVerified: false });
        session.status = "authenticated";
        post.mockRejectedValue(new ApiError(409, "Email is already verified"));
        const user = userEvent.setup();
        renderWithProviders(<VerifyEmailBanner />);

        await user.click(screen.getByRole("button", { name: "Resend link" }));

        expect(await screen.findByRole("status")).toHaveTextContent(
            "Email is already verified",
        );
    });
});
