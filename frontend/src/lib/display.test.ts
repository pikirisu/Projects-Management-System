import { describe, expect, it } from "vitest";
import {
    asUser,
    attachmentName,
    displayName,
    dueStatus,
    formatBytes,
    initials,
    projectColor,
    refId,
    toDateInput,
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
    it("uses the last path segment, decoded", () => {
        expect(
            attachmentName(
                "https://res.cloudinary.com/demo/raw/upload/spec.pdf",
            ),
        ).toBe("spec.pdf");
        expect(attachmentName("/images/quarterly%20plan.pdf")).toBe(
            "quarterly plan.pdf",
        );
    });
});

describe("projectColor", () => {
    it("is stable per project and differs between projects", () => {
        expect(projectColor("p1")).toBe(projectColor("p1"));
        expect(projectColor("p1")).not.toBe(projectColor("p2"));
    });
});

describe("dueStatus", () => {
    // Local noon on 10 March, so no timezone puts "today" on another day.
    const now = new Date(2026, 2, 10, 12);

    it("is null without a due date", () => {
        expect(dueStatus(undefined, now)).toBeNull();
        expect(dueStatus(null, now)).toBeNull();
        expect(dueStatus("not a date", now)).toBeNull();
    });

    it("counts whole calendar days, not hours", () => {
        // Stored as UTC midnight, the way the API returns it.
        expect(dueStatus("2026-03-10T00:00:00.000Z", now)).toMatchObject({
            days: 0,
            tone: "today",
            label: "Due today",
        });
        expect(dueStatus("2026-03-11T00:00:00.000Z", now)).toMatchObject({
            days: 1,
            label: "Due tomorrow",
        });
        expect(dueStatus("2026-03-09T00:00:00.000Z", now)).toMatchObject({
            days: -1,
            tone: "overdue",
        });
    });

    it("grades urgency by distance", () => {
        expect(dueStatus("2026-03-15", now)?.tone).toBe("soon");
        expect(dueStatus("2026-04-30", now)?.tone).toBe("later");
    });

    it("names the calendar day it was set to, in any timezone", () => {
        // Formatted in UTC: local formatting would say 2 Oct west of Greenwich.
        const thirdOfOctober = new Intl.DateTimeFormat(undefined, {
            day: "numeric",
            month: "short",
            timeZone: "UTC",
        }).format(Date.UTC(2026, 9, 3));
        expect(dueStatus("2026-10-03T00:00:00.000Z", now)?.label).toBe(
            `Due ${thirdOfOctober}`,
        );
        expect(toDateInput("2026-10-03T00:00:00.000Z")).toBe("2026-10-03");
        expect(toDateInput(null)).toBe("");
    });
});
