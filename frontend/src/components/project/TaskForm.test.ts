import { describe, expect, it } from "vitest";
import { buildTaskPayload, type TaskFields } from "./TaskForm";

const fields: TaskFields = {
    title: "  Ship it  ",
    description: "",
    status: "todo",
    priority: "high",
    assignedTo: "",
    dueDate: "",
};

describe("buildTaskPayload", () => {
    it("sends JSON, with null clearing the assignee and due date", () => {
        expect(buildTaskPayload(fields, [])).toEqual({
            title: "Ship it",
            description: "",
            status: "todo",
            priority: "high",
            assignedTo: null,
            dueDate: null,
        });
    });

    it("keeps a chosen assignee and due date", () => {
        expect(
            buildTaskPayload(
                { ...fields, assignedTo: "u1", dueDate: "2026-10-03" },
                [],
            ),
        ).toMatchObject({ assignedTo: "u1", dueDate: "2026-10-03" });
    });

    it("switches to multipart for files, where empty means clear", () => {
        const file = new File(["x"], "spec.txt", { type: "text/plain" });
        const body = buildTaskPayload(fields, [file]);

        expect(body).toBeInstanceOf(FormData);
        const form = body as FormData;
        expect(form.get("title")).toBe("Ship it");
        // Multipart has no null: "" is what the server reads as "none".
        expect(form.get("assignedTo")).toBe("");
        expect(form.get("dueDate")).toBe("");
        expect(form.getAll("attachments")).toHaveLength(1);
    });
});
