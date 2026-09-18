// End-to-end smoke test for the V1 backend.
//
// Preconditions:
//   - `npm run dev` (or `npm start`) already running.
//   - .env's MONGO_URI reachable and SERVER_URL pointing at that same running server.
//
// Run with: node scripts/verify.mjs
// Cleans up everything it creates (DB docs + uploaded test file) in a finally block.

import "dotenv/config";
import assert from "node:assert/strict";
import { test } from "node:test";
import mongoose from "mongoose";
import fs from "node:fs/promises";
import path from "node:path";

if (!process.env.SERVER_URL) {
    throw new Error(
        "SERVER_URL is not set in .env — required to run this script.",
    );
}
if (!process.env.MONGO_URI) {
    throw new Error(
        "MONGO_URI is not set in .env — required to run this script.",
    );
}

const BASE = `${process.env.SERVER_URL}/api/v1`;
const STAMP = Date.now();

async function api(pathname, { method = "GET", token, body, form } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    let payload = body;
    if (body && !form) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
    }
    const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers,
        body: form ?? payload,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, json };
}

test("V1 backend smoke test", async (t) => {
    await mongoose.connect(process.env.MONGO_URI);
    const createdProjectIds = [];
    const createdUserIds = [];
    const createdTaskIds = [];
    const uploadedFiles = [];

    try {
        let adminToken, memberToken, adminId, memberId;
        let projectId, otherProjectId, taskId, subTaskId, noteId;

        await t.test("register + login admin & member", async () => {
            const a = await api("/auth/register", {
                method: "POST",
                body: {
                    email: `verify-admin-${STAMP}@test.local`,
                    username: `vadmin${STAMP}`,
                    password: "Passw0rd!",
                },
            });
            assert.equal(a.status, 201, JSON.stringify(a.json));
            createdUserIds.push(a.json.data.user._id);

            const b = await api("/auth/register", {
                method: "POST",
                body: {
                    email: `verify-member-${STAMP}@test.local`,
                    username: `vmember${STAMP}`,
                    password: "Passw0rd!",
                },
            });
            assert.equal(b.status, 201, JSON.stringify(b.json));
            createdUserIds.push(b.json.data.user._id);

            const la = await api("/auth/login", {
                method: "POST",
                body: {
                    email: `verify-admin-${STAMP}@test.local`,
                    password: "Passw0rd!",
                },
            });
            assert.equal(la.status, 200, JSON.stringify(la.json));
            adminToken = la.json.data.accessToken;
            adminId = la.json.data.user._id;

            const lb = await api("/auth/login", {
                method: "POST",
                body: {
                    email: `verify-member-${STAMP}@test.local`,
                    password: "Passw0rd!",
                },
            });
            assert.equal(lb.status, 200, JSON.stringify(lb.json));
            memberToken = lb.json.data.accessToken;
            memberId = lb.json.data.user._id;
        });

        await t.test("current-user is GET and returns the caller", async () => {
            const me = await api("/auth/current-user", { token: adminToken });
            assert.equal(me.status, 200, JSON.stringify(me.json));
            assert.equal(
                me.json.data.email,
                `verify-admin-${STAMP}@test.local`,
            );
        });

        await t.test("create project as admin, add member", async () => {
            const p = await api("/projects", {
                method: "POST",
                token: adminToken,
                body: {
                    name: `Verify Project ${STAMP}`,
                    description: "smoke test",
                },
            });
            assert.equal(p.status, 201, JSON.stringify(p.json));
            projectId = p.json.data._id;
            createdProjectIds.push(projectId);

            const p2 = await api("/projects", {
                method: "POST",
                token: adminToken,
                body: {
                    name: `Verify Project Other ${STAMP}`,
                    description: "unrelated",
                },
            });
            assert.equal(p2.status, 201, JSON.stringify(p2.json));
            otherProjectId = p2.json.data._id;
            createdProjectIds.push(otherProjectId);

            const m = await api(`/projects/${projectId}/members`, {
                method: "POST",
                token: adminToken,
                body: {
                    email: `verify-member-${STAMP}@test.local`,
                    role: "member",
                },
            });
            assert.equal(m.status, 201, JSON.stringify(m.json));
        });

        await t.test(
            "getProjects aggregation returns sane shape with member count",
            async () => {
                const list = await api("/projects", { token: adminToken });
                assert.equal(list.status, 200, JSON.stringify(list.json));
                const entry = list.json.data.find(
                    (e) => e.project?._id === projectId,
                );
                assert.ok(
                    entry,
                    "created project not found in getProjects result",
                );
                assert.equal(
                    entry.project.members,
                    2,
                    `expected 2 members, got ${JSON.stringify(entry)}`,
                );
                assert.equal(entry.role, "admin");
            },
        );

        await t.test(
            "RBAC: members list requires project membership",
            async () => {
                const membersOk = await api(`/projects/${projectId}/members`, {
                    token: memberToken,
                });
                assert.equal(
                    membersOk.status,
                    200,
                    JSON.stringify(membersOk.json),
                );

                // member is not on otherProjectId at all -> validateProjectPermission's
                // ProjectMember lookup misses -> existing ApiError(400, "project not found")
                const cross = await api(`/projects/${otherProjectId}/members`, {
                    token: memberToken,
                });
                assert.equal(cross.status, 400, JSON.stringify(cross.json));
            },
        );

        await t.test("member forbidden from creating tasks/notes", async () => {
            const t1 = await api(`/tasks/${projectId}`, {
                method: "POST",
                token: memberToken,
                body: { title: "should be forbidden" },
            });
            assert.equal(t1.status, 403, JSON.stringify(t1.json));

            const n1 = await api(`/notes/${projectId}`, {
                method: "POST",
                token: memberToken,
                body: { content: "should be forbidden" },
            });
            assert.equal(n1.status, 403, JSON.stringify(n1.json));
        });

        await t.test("admin creates task with attachment", async () => {
            const form = new FormData();
            form.append("title", "Verify Task");
            form.append("description", "created by verify script");
            form.append("status", "todo");
            form.append("assignedTo", memberId);
            form.append(
                "attachments",
                new Blob([Buffer.from("hello world")], { type: "text/plain" }),
                "verify-note.txt",
            );

            const c = await api(`/tasks/${projectId}`, {
                method: "POST",
                token: adminToken,
                form,
            });
            assert.equal(c.status, 201, JSON.stringify(c.json));
            taskId = c.json.data._id;
            createdTaskIds.push(taskId);
            assert.equal(c.json.data.attachments.length, 1);
            uploadedFiles.push(c.json.data.attachments[0].url.split("/").pop());

            const fileRes = await fetch(c.json.data.attachments[0].url);
            assert.equal(
                fileRes.status,
                200,
                `attachment URL not reachable: ${c.json.data.attachments[0].url}`,
            );
        });

        await t.test(
            "upload allowlist refuses executable content",
            async () => {
                const svg = new FormData();
                svg.append("title", "svg payload");
                svg.append(
                    "attachments",
                    new Blob(
                        [
                            '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>',
                        ],
                        {
                            type: "image/svg+xml",
                        },
                    ),
                    "payload.svg",
                );
                const r1 = await api(`/tasks/${projectId}`, {
                    method: "POST",
                    token: adminToken,
                    form: svg,
                });
                assert.equal(r1.status, 415, JSON.stringify(r1.json));

                // A permitted MIME type paired with a dangerous extension is also refused,
                // since the client controls the MIME header but the extension decides how
                // a browser would treat the file if it were ever served.
                const spoofed = new FormData();
                spoofed.append("title", "spoofed mime");
                spoofed.append(
                    "attachments",
                    new Blob(["<h1>hello</h1>"], { type: "text/plain" }),
                    "payload.html",
                );
                const r2 = await api(`/tasks/${projectId}`, {
                    method: "POST",
                    token: adminToken,
                    form: spoofed,
                });
                assert.equal(r2.status, 415, JSON.stringify(r2.json));
            },
        );

        await t.test(
            "getTaskById aggregation populates assignedTo",
            async () => {
                const g = await api(`/tasks/${projectId}/t/${taskId}`, {
                    token: adminToken,
                });
                assert.equal(g.status, 200, JSON.stringify(g.json));
                assert.equal(
                    g.json.data.assignedTo?.username,
                    `vmember${STAMP}`,
                );
            },
        );

        await t.test("member can view but not modify/delete task", async () => {
            const list = await api(`/tasks/${projectId}`, {
                token: memberToken,
            });
            assert.equal(list.status, 200, JSON.stringify(list.json));

            const upd = await api(`/tasks/${projectId}/t/${taskId}`, {
                method: "PUT",
                token: memberToken,
                body: { title: "hack" },
            });
            assert.equal(upd.status, 403, JSON.stringify(upd.json));

            const del = await api(`/tasks/${projectId}/t/${taskId}`, {
                method: "DELETE",
                token: memberToken,
            });
            assert.equal(del.status, 403, JSON.stringify(del.json));
        });

        await t.test("subtask asymmetric permissions", async () => {
            const c = await api(`/tasks/${projectId}/t/${taskId}/subtasks`, {
                method: "POST",
                token: adminToken,
                body: { title: "sub 1" },
            });
            assert.equal(c.status, 201, JSON.stringify(c.json));
            subTaskId = c.json.data._id;

            const memberCreate = await api(
                `/tasks/${projectId}/t/${taskId}/subtasks`,
                {
                    method: "POST",
                    token: memberToken,
                    body: { title: "nope" },
                },
            );
            assert.equal(
                memberCreate.status,
                403,
                JSON.stringify(memberCreate.json),
            );

            const memberToggle = await api(
                `/tasks/${projectId}/st/${subTaskId}`,
                {
                    method: "PUT",
                    token: memberToken,
                    body: { isCompleted: true },
                },
            );
            assert.equal(
                memberToggle.status,
                200,
                JSON.stringify(memberToggle.json),
            );
            assert.equal(memberToggle.json.data.isCompleted, true);

            const memberRename = await api(
                `/tasks/${projectId}/st/${subTaskId}`,
                {
                    method: "PUT",
                    token: memberToken,
                    body: { title: "renamed by member" },
                },
            );
            assert.equal(
                memberRename.status,
                403,
                JSON.stringify(memberRename.json),
            );

            const adminRename = await api(
                `/tasks/${projectId}/st/${subTaskId}`,
                {
                    method: "PUT",
                    token: adminToken,
                    body: { title: "renamed by admin" },
                },
            );
            assert.equal(
                adminRename.status,
                200,
                JSON.stringify(adminRename.json),
            );
            assert.equal(adminRename.json.data.title, "renamed by admin");

            const memberDelete = await api(
                `/tasks/${projectId}/st/${subTaskId}`,
                {
                    method: "DELETE",
                    token: memberToken,
                },
            );
            assert.equal(
                memberDelete.status,
                403,
                JSON.stringify(memberDelete.json),
            );

            const adminDelete = await api(
                `/tasks/${projectId}/st/${subTaskId}`,
                {
                    method: "DELETE",
                    token: adminToken,
                },
            );
            assert.equal(
                adminDelete.status,
                200,
                JSON.stringify(adminDelete.json),
            );
        });

        await t.test(
            "notes: admin-only create/update/delete, all can view",
            async () => {
                const c = await api(`/notes/${projectId}`, {
                    method: "POST",
                    token: adminToken,
                    body: { content: "note 1" },
                });
                assert.equal(c.status, 201, JSON.stringify(c.json));
                noteId = c.json.data._id;

                const memberList = await api(`/notes/${projectId}`, {
                    token: memberToken,
                });
                assert.equal(
                    memberList.status,
                    200,
                    JSON.stringify(memberList.json),
                );

                const memberUpdate = await api(
                    `/notes/${projectId}/n/${noteId}`,
                    {
                        method: "PUT",
                        token: memberToken,
                        body: { content: "hack" },
                    },
                );
                assert.equal(
                    memberUpdate.status,
                    403,
                    JSON.stringify(memberUpdate.json),
                );

                const adminUpdate = await api(
                    `/notes/${projectId}/n/${noteId}`,
                    {
                        method: "PUT",
                        token: adminToken,
                        body: { content: "updated" },
                    },
                );
                assert.equal(
                    adminUpdate.status,
                    200,
                    JSON.stringify(adminUpdate.json),
                );

                const memberDelete = await api(
                    `/notes/${projectId}/n/${noteId}`,
                    {
                        method: "DELETE",
                        token: memberToken,
                    },
                );
                assert.equal(
                    memberDelete.status,
                    403,
                    JSON.stringify(memberDelete.json),
                );

                const adminDelete = await api(
                    `/notes/${projectId}/n/${noteId}`,
                    {
                        method: "DELETE",
                        token: adminToken,
                    },
                );
                assert.equal(
                    adminDelete.status,
                    200,
                    JSON.stringify(adminDelete.json),
                );
            },
        );

        await t.test(
            "invalid/unauthorized requests handled correctly",
            async () => {
                const noAuth = await api(`/projects/${projectId}`);
                assert.equal(noAuth.status, 401, JSON.stringify(noAuth.json));

                const badId = await api(
                    `/tasks/${projectId}/t/not-a-valid-object-id`,
                    { token: adminToken },
                );
                assert.equal(badId.status, 400, JSON.stringify(badId.json));
                assert.equal(typeof badId.json?.message, "string");

                const missingTitle = await api(`/tasks/${projectId}`, {
                    method: "POST",
                    token: adminToken,
                    body: { description: "no title" },
                });
                assert.equal(
                    missingTitle.status,
                    422,
                    JSON.stringify(missingTitle.json),
                );
            },
        );

        await t.test(
            "IDOR: child resources are scoped to the project in the URL",
            async () => {
                // Seed a task, subtask, and note inside the *other* project.
                const fTask = await api(`/tasks/${otherProjectId}`, {
                    method: "POST",
                    token: adminToken,
                    body: { title: "foreign task" },
                });
                assert.equal(fTask.status, 201, JSON.stringify(fTask.json));
                const foreignTaskId = fTask.json.data._id;
                createdTaskIds.push(foreignTaskId);

                const fSub = await api(
                    `/tasks/${otherProjectId}/t/${foreignTaskId}/subtasks`,
                    {
                        method: "POST",
                        token: adminToken,
                        body: { title: "foreign subtask" },
                    },
                );
                assert.equal(fSub.status, 201, JSON.stringify(fSub.json));
                const foreignSubTaskId = fSub.json.data._id;

                const fNote = await api(`/notes/${otherProjectId}`, {
                    method: "POST",
                    token: adminToken,
                    body: { content: "foreign note" },
                });
                assert.equal(fNote.status, 201, JSON.stringify(fNote.json));
                const foreignNoteId = fNote.json.data._id;

                // The attack: pair a projectId the caller legitimately administers with a
                // child id belonging to a different project. Every one must 404 -- not 200,
                // and not 403, which would still confirm the resource exists.
                const attacks = [
                    ["GET", `/tasks/${projectId}/t/${foreignTaskId}`],
                    ["PUT", `/tasks/${projectId}/t/${foreignTaskId}`],
                    ["DELETE", `/tasks/${projectId}/t/${foreignTaskId}`],
                    ["PUT", `/tasks/${projectId}/st/${foreignSubTaskId}`],
                    ["DELETE", `/tasks/${projectId}/st/${foreignSubTaskId}`],
                    ["GET", `/notes/${projectId}/n/${foreignNoteId}`],
                    ["PUT", `/notes/${projectId}/n/${foreignNoteId}`],
                    ["DELETE", `/notes/${projectId}/n/${foreignNoteId}`],
                ];

                for (const [method, pathname] of attacks) {
                    const body =
                        method === "PUT"
                            ? {
                                  title: "pwned",
                                  content: "pwned",
                                  isCompleted: true,
                              }
                            : undefined;
                    const r = await api(pathname, {
                        method,
                        token: adminToken,
                        body,
                    });
                    assert.equal(
                        r.status,
                        404,
                        `${method} ${pathname} -> ${r.status} ${JSON.stringify(r.json)}`,
                    );
                }

                // ...and nothing in the other project was actually touched.
                const intact = await api(
                    `/tasks/${otherProjectId}/t/${foreignTaskId}`,
                    {
                        token: adminToken,
                    },
                );
                assert.equal(intact.status, 200, JSON.stringify(intact.json));
                assert.equal(intact.json.data.subtasks.length, 1);
            },
        );

        await t.test("cleanup: delete task", async () => {
            const d = await api(`/tasks/${projectId}/t/${taskId}`, {
                method: "DELETE",
                token: adminToken,
            });
            assert.equal(d.status, 200, JSON.stringify(d.json));
        });
    } finally {
        const db = mongoose.connection.db;
        const projectObjIds = createdProjectIds.map(
            (id) => new mongoose.Types.ObjectId(id),
        );
        const userObjIds = createdUserIds.map(
            (id) => new mongoose.Types.ObjectId(id),
        );
        const taskObjIds = createdTaskIds.map(
            (id) => new mongoose.Types.ObjectId(id),
        );

        await db
            .collection("projects")
            .deleteMany({ _id: { $in: projectObjIds } });
        await db
            .collection("projectmembers")
            .deleteMany({ project: { $in: projectObjIds } });
        await db
            .collection("tasks")
            .deleteMany({ project: { $in: projectObjIds } });
        if (taskObjIds.length > 0) {
            await db
                .collection("subtasks")
                .deleteMany({ task: { $in: taskObjIds } });
        }
        await db
            .collection("projectnotes")
            .deleteMany({ project: { $in: projectObjIds } });
        await db.collection("users").deleteMany({ _id: { $in: userObjIds } });

        // Filenames are randomised server-side, so clean up by the exact names the
        // API handed back rather than by guessing at a suffix.
        const imagesDir = path.resolve("public/images");
        for (const name of uploadedFiles) {
            await fs.unlink(path.join(imagesDir, name)).catch(() => {});
        }

        await mongoose.disconnect();
    }
});
