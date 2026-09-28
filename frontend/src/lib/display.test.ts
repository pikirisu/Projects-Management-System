import { describe, expect, it } from "vitest";
import {
    asUser,
    attachmentName,
    displayName,
    formatBytes,
    initials,
    refId,
} from "./display";
import type { User } from "./types";

const user: User = {
    _id: "u1",
    username: "dana",
    email: "dana@example.com",
    fullName: "Dana Owner",
};

describe("asUser / refId", () => {
    it("keeps a populated reference and drops a bare id", () => {
        expect(asUser(user)).toBe(user);
        expect(asUser("u1")).toBeNull();
        expect(asUser(undefined)).toBeNull();
    });

    it("reads the id out of either shape", () => {
        expect(refId(user)).toBe("u1");
        expect(refId("u1")).toBe("u1");
        expect(refId(null)).toBeNull();
    });
});

describe("displayName", () => {
    it("prefers the full name and falls back to the username", () => {
        expect(displayName(user)).toBe("Dana Owner");
        expect(displayName({ ...user, fullName: "   " })).toBe("dana");
        expect(displayName({ ...user, fullName: undefined })).toBe("dana");
    });

    it("labels a missing user as unassigned", () => {
        expect(displayName(null)).toBe("Unassigned");
    });
});

describe("initials", () => {
    it("takes first and last initials of a multi-word name", () => {
        expect(initials(user)).toBe("DO");
    });

    it("takes two letters from a single-word name", () => {
        expect(initials({ ...user, fullName: undefined })).toBe("DA");
    });

    it("never throws on degenerate names", () => {
        expect(initials({ ...user, fullName: "   ", username: "" })).toBe("?");
        expect(initials(null)).toBe("?");
    });
});

describe("formatBytes", () => {
    it("scales through the units", () => {
        expect(formatBytes(512)).toBe("512 B");
        expect(formatBytes(2048)).toBe("2.0 KB");
        expect(formatBytes(5 * 1024 * 1024)).toBe("5.0 MB");
        expect(formatBytes(64 * 1024 * 1024)).toBe("64 MB");
    });

    it("returns null rather than a bogus size", () => {
        expect(formatBytes(undefined)).toBeNull();
        expect(formatBytes(-1)).toBeNull();
        expect(formatBytes(Number.NaN)).toBeNull();
    });
});

describe("attachmentName", () => {
    it("uses the last path segment", () => {
        expect(
            attachmentName(
                "https://res.cloudinary.com/demo/raw/upload/spec.pdf",
            ),
        ).toBe("spec.pdf");
        expect(attachmentName("/images/1737000000-notes.txt")).toBe(
            "1737000000-notes.txt",
        );
    });

    it("decodes escaped characters", () => {
        expect(attachmentName("/images/quarterly%20plan.pdf")).toBe(
            "quarterly plan.pdf",
        );
    });
});
