// End-to-end suite for the API, run against a live server and a real MongoDB.
//
//   RATE_LIMIT_ENABLED=false npm run dev   # the flag belongs on the server
//   npm run verify
//
// It reads SERVER_URL and MONGO_URI from the environment (or .env) and removes
// everything it creates, in a finally block, even when an assertion fails.

import "dotenv/config";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { test } from "node:test";
import mongoose from "mongoose";

for (const name of ["SERVER_URL", "MONGO_URI"]) {
    if (!process.env[name]) throw new Error(`${name} is not set`);
}

const BASE = `${process.env.SERVER_URL}/api/v1`;
const STAMP = Date.now();
const PASSWORD = "Passw0rd!";
const DEMO_EMAIL = "verify-demo@test.local";

const created = { users: [], projects: [], tasks: [], files: [], avatars: [] };

// ---- helpers -----------------------------------------------------------------

async function api(pathname, { method = "GET", token, body, form } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    let payload = form;
    if (body !== undefined) {
        headers["Content-Type"] = "application/json";
        payload = JSON.stringify(body);
    }

    const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers,
        // Omitted, not undefined: fetch rejects a GET that carries a body key.
        ...(payload === undefined ? {} : { body: payload }),
    });
    const json = await res.json().catch(() => null);

    if (res.status === 429) {
        throw new Error(
            `The server throttled ${method} ${pathname}. Start it with ` +
                "RATE_LIMIT_ENABLED=false; the flag is read by the server, not by this script.",
        );
    }
    return { status: res.status, json, data: json?.data };
}

const post = (p, token, body) => api(p, { method: "POST", token, body });
const put = (p, token, body) => api(p, { method: "PUT", token, body });
const patch = (p, token, body) => api(p, { method: "PATCH", token, body });
const del = (p, token) => api(p, { method: "DELETE", token });

function expectStatus(res, status, message) {
    assert.equal(res.status, status, message ?? JSON.stringify(res.json));
    return res;
}

const emailFor = (label) => `verify-${label}-${STAMP}@test.local`;

async function register(label, extra = {}) {
    const res = expectStatus(
        await post("/auth/register", undefined, {
            email: emailFor(label),
            username: `v${label}${STAMP}`,
            password: PASSWORD,
            ...extra,
        }),
        201,
    );
    created.users.push(res.data.user._id);
    return res.data.user;
}

async function login(label, password = PASSWORD) {
    return expectStatus(
        await post("/auth/login", undefined, {
            email: emailFor(label),
            password,
        }),
        200,
    ).data;
}

async function createProject(token, name) {
    const res = expectStatus(
        await post("/projects", token, { name, description: "verify" }),
        201,
    );
    created.projects.push(res.data._id);
    return res.data._id;
}

async function createTask(projectId, token, body) {
    const res = expectStatus(
        await post(`/tasks/${projectId}`, token, body),
        201,
    );
    created.tasks.push(res.data._id);
    return res.data;
}

/** Only a hash is stored, so plant a known one to test a token flow. */
async function plantToken(userId, field) {
    const raw = `${field}-${STAMP}`;
    await mongoose.connection.db.collection("users").updateOne(
        { _id: new mongoose.Types.ObjectId(userId) },
        {
            $set: {
                [`${field}Token`]: crypto
                    .createHash("sha256")
                    .update(raw)
                    .digest("hex"),
                [`${field}Expiry`]: new Date(Date.now() + 10 * 60 * 1000),
            },
        },
    );
    return raw;
}

const png = (bytes) => new Blob([new Uint8Array(bytes)], { type: "image/png" });

function formWith(field, blob, filename, fields = {}) {
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.append(key, value);
    if (blob) form.append(field, blob, filename);
    return form;
}

// ---- the suite ---------------------------------------------------------------

test("API end to end", async (t) => {
    await mongoose.connect(process.env.MONGO_URI);

    try {
        let admin, member, outsider;
        let projectId, otherProjectId, taskId;

        await t.test("accounts: register, sign in, read back", async () => {
            const adminUser = await register("admin");
            const memberUser = await register("member");
            const outsiderUser = await register("outsider");

            admin = { ...(await login("admin")), id: adminUser._id };
            member = { ...(await login("member")), id: memberUser._id };
            outsider = { ...(await login("outsider")), id: outsiderUser._id };

            const named = await register("named", { fullName: "Ada Lovelace" });
            assert.equal(named.fullName, "Ada Lovelace");

            const me = expectStatus(
                await api("/auth/current-user", { token: admin.accessToken }),
                200,
            );
            assert.equal(me.data.email, emailFor("admin"));
        });

        await t.test(
            "registration is refused, not crashed, on bad input",
            async () => {
                // The unique index answers a duplicate, naming the field.
                const duplicate = await post("/auth/register", undefined, {
                    email: emailFor("admin"),
                    username: `vdupe${STAMP}`,
                    password: PASSWORD,
                });
                expectStatus(duplicate, 409);
                assert.equal(
                    duplicate.json.message,
                    "That email is already in use",
                );

                const short = await post("/auth/register", undefined, {
                    email: emailFor("short"),
                    username: `vshort${STAMP}`,
                    password: "Short1!",
                });
                expectStatus(short, 422);
            },
        );

        await t.test(
            "projects: create, add a member, list with counts",
            async () => {
                projectId = await createProject(
                    admin.accessToken,
                    `Verify ${STAMP}`,
                );
                otherProjectId = await createProject(
                    admin.accessToken,
                    `Verify other ${STAMP}`,
                );

                expectStatus(
                    await post(
                        `/projects/${projectId}/members`,
                        admin.accessToken,
                        {
                            email: emailFor("member"),
                            role: "member",
                        },
                    ),
                    201,
                );

                const list = expectStatus(
                    await api("/projects", { token: admin.accessToken }),
                    200,
                );
                const entry = list.data.find(
                    (e) => e.project._id === projectId,
                );
                assert.equal(entry.role, "admin");
                assert.equal(entry.project.members, 2);
                assert.deepEqual(entry.project.taskCounts, {});
            },
        );

        await t.test(
            "project names belong to their team, not the whole server",
            async () => {
                // Another account may use the same name: names are not global.
                await createProject(outsider.accessToken, `Verify ${STAMP}`);
            },
        );

        await t.test(
            "RBAC: a project you are not in looks like one that does not exist",
            async () => {
                expectStatus(
                    await api(`/projects/${projectId}/members`, {
                        token: member.accessToken,
                    }),
                    200,
                );

                const cross = expectStatus(
                    await api(`/projects/${otherProjectId}/members`, {
                        token: member.accessToken,
                    }),
                    404,
                );
                const invented = await api(
                    "/projects/6abb000000000000000000aa/members",
                    {
                        token: member.accessToken,
                    },
                );
                assert.equal(invented.status, cross.status);
                assert.equal(invented.json.message, cross.json.message);
            },
        );

        await t.test(
            "RBAC: a member cannot create tasks or notes",
            async () => {
                expectStatus(
                    await post(`/tasks/${projectId}`, member.accessToken, {
                        title: "no",
                    }),
                    403,
                );
                expectStatus(
                    await post(`/notes/${projectId}`, member.accessToken, {
                        content: "no",
                    }),
                    403,
                );
            },
        );

        await t.test(
            "tasks: create with an attachment, served as a download",
            async () => {
                const form = formWith(
                    "attachments",
                    new Blob(["hello world"], { type: "text/plain" }),
                    "verify-note.txt",
                    {
                        title: "Verify task",
                        description: "created by verify",
                        status: "todo",
                        assignedTo: member.id,
                    },
                );
                const res = expectStatus(
                    await api(`/tasks/${projectId}`, {
                        method: "POST",
                        token: admin.accessToken,
                        form,
                    }),
                    201,
                );
                taskId = res.data._id;
                created.tasks.push(taskId);
                assert.equal(res.data.attachments.length, 1);
                assert.equal(
                    res.data.priority,
                    "medium",
                    "priority defaults to medium",
                );

                const url = res.data.attachments[0].url;
                created.files.push(url.split("/").pop());
                const file = await fetch(url);
                assert.equal(file.status, 200);
                assert.equal(
                    file.headers.get("content-disposition"),
                    "attachment",
                );
                assert.equal(
                    file.headers.get("x-content-type-options"),
                    "nosniff",
                );
            },
        );

        await t.test(
            "uploads: the allowlist refuses executable content",
            async () => {
                const svg = formWith(
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
                    { title: "svg" },
                );
                expectStatus(
                    await api(`/tasks/${projectId}`, {
                        method: "POST",
                        token: admin.accessToken,
                        form: svg,
                    }),
                    415,
                );

                // An allowed MIME type paired with an extension it does not own.
                const spoofed = formWith(
                    "attachments",
                    new Blob(["<h1>hi</h1>"], { type: "text/plain" }),
                    "payload.html",
                    { title: "spoofed" },
                );
                expectStatus(
                    await api(`/tasks/${projectId}`, {
                        method: "POST",
                        token: admin.accessToken,
                        form: spoofed,
                    }),
                    415,
                );

                const six = formWith(null, null, null, { title: "six files" });
                for (let i = 0; i < 6; i += 1)
                    six.append("attachments", png(8), `f${i}.png`);
                const tooMany = expectStatus(
                    await api(`/tasks/${projectId}`, {
                        method: "POST",
                        token: admin.accessToken,
                        form: six,
                    }),
                    400,
                );
                assert.match(tooMany.json.message, /at most 5 files/);

                const unknown = expectStatus(
                    await api(`/tasks/${projectId}`, {
                        method: "POST",
                        token: admin.accessToken,
                        form: formWith("avatar", png(8), "a.png", {
                            title: "wrong field",
                        }),
                    }),
                    400,
                );
                assert.match(unknown.json.message, /Unexpected field/);
            },
        );

        await t.test(
            "tasks: detail joins the assignee; a member reads but cannot write",
            async () => {
                const detail = expectStatus(
                    await api(`/tasks/${projectId}/t/${taskId}`, {
                        token: admin.accessToken,
                    }),
                    200,
                );
                assert.equal(
                    detail.data.assignedTo?.username,
                    `vmember${STAMP}`,
                );

                expectStatus(
                    await api(`/tasks/${projectId}`, {
                        token: member.accessToken,
                    }),
                    200,
                );
                expectStatus(
                    await put(
                        `/tasks/${projectId}/t/${taskId}`,
                        member.accessToken,
                        { title: "x" },
                    ),
                    403,
                );
                expectStatus(
                    await del(
                        `/tasks/${projectId}/t/${taskId}`,
                        member.accessToken,
                    ),
                    403,
                );
            },
        );

        await t.test(
            "tasks: priority and due date are validated, stored and clearable",
            async () => {
                const task = await createTask(projectId, admin.accessToken, {
                    title: "Due soon",
                    priority: "high",
                    dueDate: "2026-10-03",
                    assignedTo: member.id,
                });
                assert.equal(task.priority, "high");
                assert.equal(task.dueDate, "2026-10-03T00:00:00.000Z");

                expectStatus(
                    await post(`/tasks/${projectId}`, admin.accessToken, {
                        title: "x",
                        priority: "urgent",
                    }),
                    422,
                );
                expectStatus(
                    await post(`/tasks/${projectId}`, admin.accessToken, {
                        title: "x",
                        dueDate: "soon",
                    }),
                    422,
                );

                // null clears an optional field: this is how a task is unassigned.
                const cleared = expectStatus(
                    await put(
                        `/tasks/${projectId}/t/${task._id}`,
                        admin.accessToken,
                        {
                            assignedTo: null,
                            dueDate: null,
                        },
                    ),
                    200,
                );
                assert.equal(cleared.data.assignedTo, undefined);
                assert.equal(cleared.data.dueDate, undefined);
                assert.equal(
                    cleared.data.priority,
                    "high",
                    "untouched fields stay",
                );

                // Multipart cannot say null, so "" means the same thing there.
                const reassigned = expectStatus(
                    await put(
                        `/tasks/${projectId}/t/${task._id}`,
                        admin.accessToken,
                        { assignedTo: member.id },
                    ),
                    200,
                );
                assert.equal(reassigned.data.assignedTo, member.id);
                const viaForm = expectStatus(
                    await api(`/tasks/${projectId}/t/${task._id}`, {
                        method: "PUT",
                        token: admin.accessToken,
                        form: formWith(null, null, null, { assignedTo: "" }),
                    }),
                    200,
                );
                assert.equal(viaForm.data.assignedTo, undefined);
            },
        );

        await t.test("projects: the list counts tasks by status", async () => {
            const list = await api("/projects", { token: admin.accessToken });
            const entry = list.data.find((e) => e.project._id === projectId);
            assert.deepEqual(entry.project.taskCounts, { todo: 2 });
        });

        await t.test(
            "subtasks: anyone may tick, only managers rename or remove",
            async () => {
                const sub = expectStatus(
                    await post(
                        `/tasks/${projectId}/t/${taskId}/subtasks`,
                        admin.accessToken,
                        { title: "sub 1" },
                    ),
                    201,
                ).data;
                const subPath = `/tasks/${projectId}/st/${sub._id}`;

                expectStatus(
                    await post(
                        `/tasks/${projectId}/t/${taskId}/subtasks`,
                        member.accessToken,
                        { title: "no" },
                    ),
                    403,
                );

                const ticked = expectStatus(
                    await put(subPath, member.accessToken, {
                        isCompleted: true,
                    }),
                    200,
                );
                assert.equal(ticked.data.isCompleted, true);

                expectStatus(
                    await put(subPath, member.accessToken, {
                        title: "renamed",
                    }),
                    403,
                );
                const renamed = expectStatus(
                    await put(subPath, admin.accessToken, { title: "renamed" }),
                    200,
                );
                assert.equal(renamed.data.title, "renamed");

                expectStatus(await del(subPath, member.accessToken), 403);
                expectStatus(await del(subPath, admin.accessToken), 200);
            },
        );

        await t.test("notes: everyone reads, only admins write", async () => {
            const note = expectStatus(
                await post(`/notes/${projectId}`, admin.accessToken, {
                    content: "note 1",
                }),
                201,
            ).data;
            const notePath = `/notes/${projectId}/n/${note._id}`;

            expectStatus(
                await api(`/notes/${projectId}`, { token: member.accessToken }),
                200,
            );
            expectStatus(
                await put(notePath, member.accessToken, { content: "x" }),
                403,
            );
            expectStatus(
                await put(notePath, admin.accessToken, { content: "updated" }),
                200,
            );
            expectStatus(await del(notePath, member.accessToken), 403);
            expectStatus(await del(notePath, admin.accessToken), 200);
        });

        await t.test("bad input answers 4xx, never 500", async () => {
            expectStatus(await api(`/projects/${projectId}`), 401);

            const badId = expectStatus(
                await api(`/tasks/${projectId}/t/not-an-object-id`, {
                    token: admin.accessToken,
                }),
                400,
            );
            assert.equal(typeof badId.json.message, "string");

            expectStatus(
                await post(`/tasks/${projectId}`, admin.accessToken, {
                    description: "no title",
                }),
                422,
            );

            // A non-string password must never reach bcrypt.compare, which throws.
            expectStatus(
                await post("/auth/login", undefined, {
                    email: emailFor("admin"),
                    password: { $ne: null },
                }),
                422,
            );

            expectStatus(
                await post("/projects", admin.accessToken, {
                    name: "x".repeat(100_000),
                }),
                413,
            );

            const malformed = await fetch(`${BASE}/projects`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${admin.accessToken}`,
                },
                body: "{not json",
            });
            assert.equal(malformed.status, 400);

            expectStatus(
                await post("/projects", admin.accessToken, { name: "   " }),
                422,
            );
        });

        await t.test("passwords are exact: never trimmed", async () => {
            const padded = " Passw0rd! ";
            await register("pad", { password: padded });
            expectStatus(
                await post("/auth/login", undefined, {
                    email: emailFor("pad"),
                    password: padded,
                }),
                200,
            );
            expectStatus(
                await post("/auth/login", undefined, {
                    email: emailFor("pad"),
                    password: padded.trim(),
                }),
                401,
            );
        });

        await t.test(
            "a task cannot be assigned outside its project",
            async () => {
                expectStatus(
                    await post(`/tasks/${projectId}`, admin.accessToken, {
                        title: "x",
                        assignedTo: outsider.id,
                    }),
                    400,
                );
                expectStatus(
                    await put(
                        `/tasks/${projectId}/t/${taskId}`,
                        admin.accessToken,
                        { assignedTo: outsider.id },
                    ),
                    400,
                );
                expectStatus(
                    await put(
                        `/tasks/${projectId}/t/${taskId}`,
                        admin.accessToken,
                        { assignedTo: member.id },
                    ),
                    200,
                );
            },
        );

        await t.test(
            "my tasks: only mine, only from projects I am still in",
            async () => {
                // A second project, where the member is assigned work.
                const sideProject = await createProject(
                    admin.accessToken,
                    `Verify side ${STAMP}`,
                );
                expectStatus(
                    await post(
                        `/projects/${sideProject}/members`,
                        admin.accessToken,
                        {
                            email: emailFor("member"),
                            role: "member",
                        },
                    ),
                    201,
                );
                const sideTask = await createTask(
                    sideProject,
                    admin.accessToken,
                    {
                        title: "Side work",
                        assignedTo: member.id,
                    },
                );
                await createTask(sideProject, admin.accessToken, {
                    title: "Someone else's",
                });

                const mine = expectStatus(
                    await api("/me/tasks", { token: member.accessToken }),
                    200,
                );
                const titles = mine.data.map((task) => task.title);
                assert.ok(titles.includes("Side work"), JSON.stringify(titles));
                assert.ok(
                    titles.includes("Verify task"),
                    JSON.stringify(titles),
                );
                assert.ok(!titles.includes("Someone else's"));
                const side = mine.data.find(
                    (task) => task._id === sideTask._id,
                );
                assert.equal(side.project.name, `Verify side ${STAMP}`);

                // Leaving a project unassigns its tasks, so they leave this list.
                expectStatus(
                    await del(
                        `/projects/${sideProject}/members/${member.id}`,
                        admin.accessToken,
                    ),
                    200,
                );
                const after = await api(
                    `/tasks/${sideProject}/t/${sideTask._id}`,
                    { token: admin.accessToken },
                );
                assert.equal(after.data.assignedTo, undefined);
                const mineAfter = await api("/me/tasks", {
                    token: member.accessToken,
                });
                assert.ok(
                    !mineAfter.data.some((task) => task._id === sideTask._id),
                );

                expectStatus(await api("/me/tasks"), 401);
            },
        );

        await t.test("a project always keeps an admin", async () => {
            const members = `/projects/${projectId}/members`;
            const self = `${members}/${admin.id}`;

            expectStatus(
                await put(self, admin.accessToken, { newRole: "member" }),
                409,
            );

            // Adding only ever inserts: it cannot rewrite (or demote) a role.
            expectStatus(
                await post(members, admin.accessToken, {
                    email: emailFor("admin"),
                    role: "member",
                }),
                409,
            );
            expectStatus(
                await post(members, admin.accessToken, {
                    email: emailFor("member"),
                    role: "admin",
                }),
                409,
            );
            const roster = await api(members, { token: admin.accessToken });
            const rows = roster.data.filter(
                (entry) => entry.user?._id === admin.id,
            );
            assert.equal(rows.length, 1);
            assert.equal(rows[0].role, "admin");

            expectStatus(await del(self, admin.accessToken), 409);
            expectStatus(
                await put(
                    `${members}/6abb000000000000000000aa`,
                    admin.accessToken,
                    { newRole: "admin" },
                ),
                404,
            );
            expectStatus(
                await put(`/projects/${projectId}`, admin.accessToken, {
                    name: `Verify ${STAMP} renamed`,
                }),
                200,
            );

            // With a second admin, the first may step down; then restore both.
            expectStatus(
                await put(`${members}/${member.id}`, admin.accessToken, {
                    newRole: "admin",
                }),
                200,
            );
            expectStatus(
                await put(self, admin.accessToken, { newRole: "member" }),
                200,
            );
            expectStatus(
                await put(self, member.accessToken, { newRole: "admin" }),
                200,
            );
            expectStatus(
                await put(`${members}/${member.id}`, admin.accessToken, {
                    newRole: "member",
                }),
                200,
            );
        });

        await t.test(
            "profile: the name is editable, identity is not",
            async () => {
                const updated = expectStatus(
                    await patch("/auth/profile", member.accessToken, {
                        fullName: "  Grace Hopper  ",
                    }),
                    200,
                );
                assert.equal(updated.data.fullName, "Grace Hopper");
                assert.equal(updated.data.password, undefined);

                const me = await api("/auth/current-user", {
                    token: member.accessToken,
                });
                assert.equal(me.data.fullName, "Grace Hopper");

                expectStatus(
                    await patch("/auth/profile", member.accessToken, {
                        fullName: "   ",
                    }),
                    422,
                );
                expectStatus(
                    await patch("/auth/profile", member.accessToken, {
                        fullName: "x".repeat(81),
                    }),
                    422,
                );

                const sneaky = expectStatus(
                    await patch("/auth/profile", member.accessToken, {
                        fullName: "Grace Hopper",
                        username: `hijacked${STAMP}`,
                        email: `hijacked-${STAMP}@test.local`,
                        isEmailVerified: true,
                    }),
                    200,
                );
                assert.equal(sneaky.data.username, `vmember${STAMP}`);
                assert.equal(sneaky.data.email, emailFor("member"));

                expectStatus(
                    await patch("/auth/profile", undefined, {
                        fullName: "Nobody",
                    }),
                    401,
                );
            },
        );

        await t.test(
            "avatar: images only, replaced in place, rendered inline",
            async () => {
                const upload = (form, { anonymous = false } = {}) =>
                    api("/auth/avatar", {
                        method: "PATCH",
                        token: anonymous ? undefined : member.accessToken,
                        form,
                    });

                expectStatus(await upload(new FormData()), 400);
                expectStatus(
                    await upload(
                        formWith(
                            "avatar",
                            new Blob(["%PDF-1.4"], { type: "application/pdf" }),
                            "cv.pdf",
                        ),
                    ),
                    415,
                );
                expectStatus(
                    await upload(
                        formWith(
                            "avatar",
                            new Blob(["<svg onload=alert(1)>"], {
                                type: "image/svg+xml",
                            }),
                            "x.svg",
                        ),
                    ),
                    415,
                );
                expectStatus(
                    await upload(formWith("avatar", png(600_000), "huge.png")),
                    413,
                );
                expectStatus(
                    await upload(formWith("avatar", png(32), "a.png"), {
                        anonymous: true,
                    }),
                    401,
                );

                const first = expectStatus(
                    await upload(formWith("avatar", png(32), "me.png")),
                    200,
                );
                const firstUrl = first.data.avatar.url;
                // The contract is the URL; where the bytes live is the server's business.
                assert.deepEqual(Object.keys(first.data.avatar), ["url"]);

                const second = expectStatus(
                    await upload(formWith("avatar", png(48), "me2.png")),
                    200,
                );
                const secondUrl = second.data.avatar.url;
                assert.notEqual(secondUrl, firstUrl);

                // Only checkable on the local driver, which is what CI runs.
                if (firstUrl.startsWith(process.env.SERVER_URL)) {
                    created.avatars.push(secondUrl.split("/").pop());
                    assert.equal(
                        (await fetch(firstUrl)).status,
                        404,
                        "the replaced image is deleted",
                    );

                    const current = await fetch(secondUrl);
                    assert.equal(current.status, 200);
                    // What a real <img> on another origin needs, which fetch() ignores.
                    assert.equal(
                        current.headers.get("cross-origin-resource-policy"),
                        "cross-origin",
                    );
                    assert.equal(
                        current.headers.get("content-disposition"),
                        null,
                    );
                    assert.equal(
                        current.headers.get("x-content-type-options"),
                        "nosniff",
                    );

                    const crossed = await fetch(
                        secondUrl.replace("/avatars/", "/images/"),
                    );
                    assert.equal(
                        crossed.status,
                        404,
                        "the two upload directories stay apart",
                    );
                }

                const me = await api("/auth/current-user", {
                    token: member.accessToken,
                });
                assert.equal(me.data.avatar.url, secondUrl);
            },
        );

        await t.test(
            "a shared demo account cannot be locked or defaced",
            {
                skip: !process.env.DEMO_EMAILS?.includes(DEMO_EMAIL)
                    ? `set DEMO_EMAILS=${DEMO_EMAIL} on the server and here`
                    : false,
            },
            async () => {
                // A fixed address, so the server's DEMO_EMAILS can name it.
                // A run that died before cleanup leaves it behind: reuse it.
                const registered = await post("/auth/register", undefined, {
                    email: DEMO_EMAIL,
                    username: "verifydemo",
                    password: PASSWORD,
                });
                if (registered.status === 201) {
                    created.users.push(registered.data.user._id);
                }
                const session = expectStatus(
                    await post("/auth/login", undefined, {
                        email: DEMO_EMAIL,
                        password: PASSWORD,
                    }),
                    200,
                ).data;
                if (registered.status !== 201) {
                    created.users.push(session.user._id);
                }
                const token = session.accessToken;

                expectStatus(
                    await post("/auth/change-password", token, {
                        oldPassword: PASSWORD,
                        newPassword: "Hijacked1!",
                    }),
                    403,
                );
                expectStatus(
                    await patch("/auth/profile", token, {
                        fullName: "Mallory",
                    }),
                    403,
                );
                expectStatus(
                    await api("/auth/avatar", {
                        method: "PATCH",
                        token,
                        form: formWith("avatar", png(32), "x.png"),
                    }),
                    403,
                );

                // Everything else works: it is a real account.
                await createProject(token, `Verify demo ${STAMP}`);
            },
        );

        await t.test("no user-shaped response carries a secret", async () => {
            const PRIVATE = [
                "password",
                "refreshToken",
                "forgotPasswordToken",
                "forgotPasswordExpiry",
                "emailVerificationToken",
                "emailVerificationExpiry",
                "credentialsChangedAt",
            ];
            // Asserted exactly, so a field added to the model fails here until
            // it is classified as public (listed) or private (stripped).
            const PUBLIC = [
                "_id",
                "avatar",
                "username",
                "email",
                "fullName",
                "isEmailVerified",
                "createdAt",
                "updatedAt",
                "__v",
            ];
            const assertClean = (where, user) => {
                assert.ok(user, `${where} returned no user`);
                for (const field of PRIVATE) {
                    assert.equal(
                        user[field],
                        undefined,
                        `${where} leaks ${field}`,
                    );
                }
                const unexpected = Object.keys(user).filter(
                    (key) => !PUBLIC.includes(key),
                );
                assert.deepEqual(
                    unexpected,
                    [],
                    `${where} returned unclassified fields`,
                );
            };

            assertClean(
                "register",
                await register("leak", { fullName: "Leak Probe" }),
            );
            // Populates the reset fields, which current-user once returned.
            await post("/auth/forgot-password", undefined, {
                email: emailFor("leak"),
            });

            const session = await login("leak");
            assertClean("login", session.user);
            assertClean(
                "current-user",
                (
                    await api("/auth/current-user", {
                        token: session.accessToken,
                    })
                ).data,
            );
            assertClean(
                "profile",
                (
                    await patch("/auth/profile", session.accessToken, {
                        fullName: "Leak Probe",
                    })
                ).data,
            );

            expectStatus(
                await post("/auth/change-password", session.accessToken, {
                    oldPassword: PASSWORD,
                    newPassword: "Str0nger!",
                }),
                200,
            );
            const after = await login("leak", "Str0nger!");
            assertClean("login after a change", after.user);
            assertClean(
                "current-user after a change",
                (await api("/auth/current-user", { token: after.accessToken }))
                    .data,
            );
        });

        await t.test("email verification flips the flag once", async () => {
            const raw = await plantToken(outsider.id, "emailVerification");

            expectStatus(await api("/auth/verify-email/not-the-token"), 400);
            const verified = expectStatus(
                await api(`/auth/verify-email/${raw}`),
                200,
            );
            assert.equal(verified.data.isEmailVerified, true);
            expectStatus(
                await api(`/auth/verify-email/${raw}`),
                400,
                "a link works once",
            );

            const session = await login("outsider");
            const me = await api("/auth/current-user", {
                token: session.accessToken,
            });
            assert.equal(me.data.isEmailVerified, true);
        });

        await t.test(
            "a password reset or change ends every session",
            async () => {
                // The same answer whether or not the address has an account.
                expectStatus(
                    await post("/auth/forgot-password", undefined, {
                        email: emailFor("member"),
                    }),
                    200,
                );
                expectStatus(
                    await post("/auth/forgot-password", undefined, {
                        email: `nobody-${STAMP}@test.local`,
                    }),
                    200,
                );

                const raw = await plantToken(member.id, "forgotPassword");
                expectStatus(
                    await post(
                        "/auth/reset-password/not-the-token",
                        undefined,
                        { newPassword: "Whatever1!" },
                    ),
                    400,
                );
                expectStatus(
                    await post(`/auth/reset-password/${raw}`, undefined, {
                        newPassword: "Short1!",
                    }),
                    422,
                );

                // The session a reset exists to evict: both halves of it.
                const stale = {
                    access: member.accessToken,
                    refresh: member.refreshToken,
                };
                expectStatus(
                    await post(`/auth/reset-password/${raw}`, undefined, {
                        newPassword: "N3wPassw0rd!",
                    }),
                    200,
                );

                expectStatus(
                    await post("/auth/refresh-token", undefined, {
                        refreshToken: stale.refresh,
                    }),
                    401,
                );
                expectStatus(
                    await api("/auth/current-user", { token: stale.access }),
                    401,
                );
                expectStatus(
                    await post("/projects", stale.access, {
                        name: `evicted ${STAMP}`,
                    }),
                    401,
                );

                const fresh = await login("member", "N3wPassw0rd!");
                expectStatus(
                    await post("/auth/login", undefined, {
                        email: emailFor("member"),
                        password: PASSWORD,
                    }),
                    401,
                );

                // `iat` is whole seconds and a token from the same second survives,
                // so wait one out rather than assert what the rule does not claim.
                await new Promise((resolve) => setTimeout(resolve, 1100));

                expectStatus(
                    await post("/auth/change-password", fresh.accessToken, {
                        oldPassword: "N3wPassw0rd!",
                        newPassword: PASSWORD,
                    }),
                    200,
                );
                expectStatus(
                    await post("/auth/refresh-token", undefined, {
                        refreshToken: fresh.refreshToken,
                    }),
                    401,
                );
                expectStatus(
                    await api("/auth/current-user", {
                        token: fresh.accessToken,
                    }),
                    401,
                );

                member = { ...(await login("member")), id: member.id };
                expectStatus(
                    await post(`/auth/reset-password/${raw}`, undefined, {
                        newPassword: "An0therOne!",
                    }),
                    400,
                );
            },
        );

        await t.test(
            "IDOR: a child resource answers only to its own project",
            async () => {
                const foreignTask = await createTask(
                    otherProjectId,
                    admin.accessToken,
                    { title: "foreign" },
                );
                const foreignSub = expectStatus(
                    await post(
                        `/tasks/${otherProjectId}/t/${foreignTask._id}/subtasks`,
                        admin.accessToken,
                        { title: "sub" },
                    ),
                    201,
                ).data;
                const foreignNote = expectStatus(
                    await post(`/notes/${otherProjectId}`, admin.accessToken, {
                        content: "foreign",
                    }),
                    201,
                ).data;

                // A project the caller administers, paired with another project's
                // child id: 404, not 403, which would confirm the id exists.
                const attacks = [
                    ["GET", `/tasks/${projectId}/t/${foreignTask._id}`],
                    ["PUT", `/tasks/${projectId}/t/${foreignTask._id}`],
                    ["DELETE", `/tasks/${projectId}/t/${foreignTask._id}`],
                    ["PUT", `/tasks/${projectId}/st/${foreignSub._id}`],
                    ["DELETE", `/tasks/${projectId}/st/${foreignSub._id}`],
                    ["GET", `/notes/${projectId}/n/${foreignNote._id}`],
                    ["PUT", `/notes/${projectId}/n/${foreignNote._id}`],
                    ["DELETE", `/notes/${projectId}/n/${foreignNote._id}`],
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
                    const res = await api(pathname, {
                        method,
                        token: admin.accessToken,
                        body,
                    });
                    assert.equal(
                        res.status,
                        404,
                        `${method} ${pathname} -> ${res.status}`,
                    );
                }

                const intact = expectStatus(
                    await api(`/tasks/${otherProjectId}/t/${foreignTask._id}`, {
                        token: admin.accessToken,
                    }),
                    200,
                );
                assert.equal(intact.data.subtasks.length, 1);
            },
        );

        await t.test(
            "one attachment can be removed without its task",
            async () => {
                const before = await api(`/tasks/${projectId}/t/${taskId}`, {
                    token: admin.accessToken,
                });
                const attachment = before.data.attachments[0];
                const attachmentPath = `/tasks/${projectId}/t/${taskId}/attachments/${attachment._id}`;

                expectStatus(
                    await del(attachmentPath, member.accessToken),
                    403,
                );
                const removed = expectStatus(
                    await del(attachmentPath, admin.accessToken),
                    200,
                );
                assert.equal(removed.data.attachments.length, 0);

                const after = expectStatus(
                    await api(`/tasks/${projectId}/t/${taskId}`, {
                        token: admin.accessToken,
                    }),
                    200,
                );
                assert.equal(after.data.attachments.length, 0);

                expectStatus(await del(attachmentPath, admin.accessToken), 404);
                expectStatus(
                    await del(
                        `/tasks/${otherProjectId}/t/${taskId}/attachments/${attachment._id}`,
                        admin.accessToken,
                    ),
                    404,
                );
            },
        );

        await t.test(
            "deleting a project removes everything under it",
            async () => {
                const cascadeId = await createProject(
                    admin.accessToken,
                    `Verify cascade ${STAMP}`,
                );
                await post(
                    `/projects/${cascadeId}/members`,
                    admin.accessToken,
                    {
                        email: emailFor("member"),
                        role: "member",
                    },
                );
                const task = await createTask(cascadeId, admin.accessToken, {
                    title: "cascade",
                });
                await post(
                    `/tasks/${cascadeId}/t/${task._id}/subtasks`,
                    admin.accessToken,
                    { title: "sub" },
                );
                await post(`/notes/${cascadeId}`, admin.accessToken, {
                    content: "note",
                });

                expectStatus(
                    await del(`/projects/${cascadeId}`, admin.accessToken),
                    200,
                );

                // MongoDB has no foreign keys, so count the collections directly.
                const db = mongoose.connection.db;
                const project = new mongoose.Types.ObjectId(cascadeId);
                const leftovers = {
                    projectmembers: await db
                        .collection("projectmembers")
                        .countDocuments({ project }),
                    tasks: await db
                        .collection("tasks")
                        .countDocuments({ project }),
                    subtasks: await db.collection("subtasks").countDocuments({
                        task: new mongoose.Types.ObjectId(task._id),
                    }),
                    projectnotes: await db
                        .collection("projectnotes")
                        .countDocuments({ project }),
                };
                assert.deepEqual(leftovers, {
                    projectmembers: 0,
                    tasks: 0,
                    subtasks: 0,
                    projectnotes: 0,
                });
            },
        );
    } finally {
        const db = mongoose.connection.db;
        const ids = (list) => list.map((id) => new mongoose.Types.ObjectId(id));
        const projects = ids(created.projects);

        await db.collection("projects").deleteMany({ _id: { $in: projects } });
        await db
            .collection("projectmembers")
            .deleteMany({ project: { $in: projects } });
        await db.collection("tasks").deleteMany({ project: { $in: projects } });
        await db
            .collection("subtasks")
            .deleteMany({ task: { $in: ids(created.tasks) } });
        await db
            .collection("projectnotes")
            .deleteMany({ project: { $in: projects } });
        await db
            .collection("users")
            .deleteMany({ _id: { $in: ids(created.users) } });

        // Stored names are random, so remove exactly the ones the API returned.
        for (const [dir, names] of [
            ["public/images", created.files],
            ["public/avatars", created.avatars],
        ]) {
            for (const name of names) {
                await fs.unlink(path.resolve(dir, name)).catch(() => {});
            }
        }

        await mongoose.disconnect();
    }
});
