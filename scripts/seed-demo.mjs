// Fills a running server with a small demo workspace, so every screen has
// something to show: two accounts, two projects, tasks across every status
// with priorities and due dates (one overdue), subtasks and notes.
//
//   npm run seed            add the demo workspace if it is not there yet
//   npm run seed -- --reset rebuild it from scratch
//
// It talks to the API at SERVER_URL, so it needs the server running.

import "dotenv/config";

if (!process.env.SERVER_URL) throw new Error("SERVER_URL is not set");

const BASE = `${process.env.SERVER_URL.replace(/\/+$/, "")}/api/v1`;
const RESET = process.argv.includes("--reset");

const ACCOUNTS = {
    owner: {
        email: "demo.owner@example.com",
        username: "demoowner",
        password: "DemoPass123!",
        fullName: "Dana Owner",
    },
    teammate: {
        email: "demo.teammate@example.com",
        username: "demomate",
        password: "DemoPass123!",
        fullName: "Sam Teammate",
    },
};

/** A YYYY-MM-DD `days` from today. */
const inDays = (days) => {
    const date = new Date();
    date.setDate(date.getDate() + days);
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
};

const PROJECTS = [
    {
        name: "Website relaunch",
        description:
            "Marketing site rebuild: new pricing page, CMS migration and analytics.",
        teammateRole: "project_admin",
        note: "Launch is gated on the pricing page and the CMS migration. Everything else can ship behind a flag.",
        tasks: [
            {
                title: "Audit current site performance",
                description:
                    "Lighthouse run on the top ten pages; record LCP and CLS per template.",
                status: "done",
                priority: "medium",
                subtasks: [
                    ["Run Lighthouse on templates", true],
                    ["Write up the findings", true],
                ],
            },
            {
                title: "Rebuild the pricing page",
                description:
                    "Three tiers, an annual/monthly toggle, and an FAQ below the fold.",
                status: "in_progress",
                priority: "high",
                dueDate: inDays(2),
                assignee: "teammate",
                subtasks: [
                    ["Copy review with marketing", true],
                    ["Build the tier cards", false],
                    ["Wire the billing toggle", false],
                ],
            },
            {
                title: "Migrate blog posts to the new CMS",
                description: "412 posts, plus redirects for the old slugs.",
                status: "todo",
                priority: "high",
                dueDate: inDays(-1),
                assignee: "owner",
                subtasks: [
                    ["Export the existing posts", false],
                    ["Map old slugs to new ones", false],
                ],
            },
            {
                title: "Set up analytics on the new funnel",
                status: "todo",
                priority: "low",
                dueDate: inDays(12),
                assignee: "teammate",
            },
            {
                title: "Write the launch announcement",
                status: "todo",
                priority: "medium",
                dueDate: inDays(0),
                assignee: "owner",
            },
        ],
    },
    {
        name: "Mobile app beta",
        description: "Get the first build into testers' hands.",
        teammateRole: "member",
        note: "Beta testers are recruited from the waitlist. Keep the build count low; every build needs a changelog.",
        tasks: [
            {
                title: "Push notifications",
                status: "in_progress",
                priority: "medium",
                dueDate: inDays(5),
                assignee: "owner",
                subtasks: [
                    ["Register device tokens", true],
                    ["Send a test push", false],
                ],
            },
            {
                title: "Crash reporting",
                status: "todo",
                priority: "high",
                dueDate: inDays(4),
                assignee: "teammate",
            },
            {
                title: "TestFlight build",
                status: "done",
                priority: "medium",
            },
        ],
    },
];

async function api(pathname, { method = "GET", token, body } = {}) {
    const headers = token ? { Authorization: `Bearer ${token}` } : {};
    if (body) headers["Content-Type"] = "application/json";

    const res = await fetch(`${BASE}${pathname}`, {
        method,
        headers,
        ...(body ? { body: JSON.stringify(body) } : {}),
    });
    const envelope = await res.json().catch(() => null);
    if (!res.ok && !(method === "POST" && res.status === 409)) {
        throw new Error(
            `${method} ${pathname} failed (${res.status}): ${envelope?.message}`,
        );
    }
    return { status: res.status, data: envelope?.data };
}

/** Registers if new (409 means a previous run did), then signs in. */
async function ensureAccount(account) {
    await api("/auth/register", { method: "POST", body: account });
    const { data } = await api("/auth/login", {
        method: "POST",
        body: { email: account.email, password: account.password },
    });

    // Older demo accounts may predate fullName; set it every run.
    if (data.user.fullName !== account.fullName) {
        await api("/auth/profile", {
            method: "PATCH",
            token: data.accessToken,
            body: { fullName: account.fullName },
        });
    }
    return { token: data.accessToken, id: data.user._id };
}

async function seedProject(spec, owner, teammate) {
    const { data: project } = await api("/projects", {
        method: "POST",
        token: owner.token,
        body: { name: spec.name, description: spec.description },
    });
    const id = project._id;
    const ids = { owner: owner.id, teammate: teammate.id };

    await api(`/projects/${id}/members`, {
        method: "POST",
        token: owner.token,
        body: { email: ACCOUNTS.teammate.email, role: spec.teammateRole },
    });

    for (const { subtasks = [], assignee, ...fields } of spec.tasks) {
        const { data: task } = await api(`/tasks/${id}`, {
            method: "POST",
            token: owner.token,
            body: { ...fields, ...(assignee && { assignedTo: ids[assignee] }) },
        });
        for (const [title, isCompleted] of subtasks) {
            const { data: subtask } = await api(
                `/tasks/${id}/t/${task._id}/subtasks`,
                { method: "POST", token: owner.token, body: { title } },
            );
            if (isCompleted) {
                await api(`/tasks/${id}/st/${subtask._id}`, {
                    method: "PUT",
                    token: owner.token,
                    body: { isCompleted: true },
                });
            }
        }
    }

    await api(`/notes/${id}`, {
        method: "POST",
        token: owner.token,
        body: { content: spec.note },
    });
    return id;
}

async function main() {
    const owner = await ensureAccount(ACCOUNTS.owner);
    const teammate = await ensureAccount(ACCOUNTS.teammate);
    console.log("✔ accounts ready");

    const { data: existing } = await api("/projects", { token: owner.token });
    const demoNames = new Set(PROJECTS.map((spec) => spec.name));
    const found = existing.filter((entry) => demoNames.has(entry.project.name));

    if (found.length > 0 && !RESET) {
        console.log("✔ demo workspace already exists (--reset rebuilds it)");
    } else {
        for (const entry of found) {
            await api(`/projects/${entry.project._id}`, {
                method: "DELETE",
                token: owner.token,
            });
        }
        for (const spec of PROJECTS) {
            await seedProject(spec, owner, teammate);
            console.log(`✔ ${spec.name}: ${spec.tasks.length} tasks`);
        }
    }

    console.log("\nSign in with either account (password DemoPass123!):");
    console.log(`  ${ACCOUNTS.owner.email}     admin of both projects`);
    console.log(`  ${ACCOUNTS.teammate.email}  project admin, then member`);
}

main().catch((error) => {
    console.error(`\n✖ ${error.message}`);
    process.exitCode = 1;
});
