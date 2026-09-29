// Populates a running server with a small, realistic demo workspace so the
// frontend has something to show: two accounts, one project, members in three
// roles, tasks across every status, subtasks and a note.
//
// Preconditions:
//   - `npm run dev` (or `npm start`) already running.
//   - .env's SERVER_URL pointing at that running server.
//
// Run with: node scripts/seed-demo.mjs
//
// Safe to run repeatedly: accounts are reused if they already exist, and the
// project is matched by name rather than duplicated. Pass --reset to delete the
// demo project (and everything under it) before seeding.

import "dotenv/config";

if (!process.env.SERVER_URL) {
    throw new Error(
        "SERVER_URL is not set in .env — required to run this script.",
    );
}

const BASE = `${process.env.SERVER_URL.replace(/\/+$/, "")}/api/v1`;
const RESET = process.argv.includes("--reset");

const PROJECT_NAME = "Demo — Website relaunch";

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

async function api(pathname, { method = "GET", token, body } = {}) {
    const headers = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body) headers["Content-Type"] = "application/json";

    const response = await fetch(`${BASE}${pathname}`, {
        method,
        headers,
        // See the note in scripts/verify.mjs: a GET must not carry a body key.
        ...(body ? { body: JSON.stringify(body) } : {}),
    });

    const envelope = await response.json().catch(() => null);
    return { status: response.status, body: envelope, data: envelope?.data };
}

/** Register if new, then log in either way. Returns the access token. */
async function ensureAccount(account) {
    const registered = await api("/auth/register", {
        method: "POST",
        body: account,
    });

    // 409 means the account survived a previous run, which is the happy path
    // on every invocation after the first.
    if (registered.status !== 201 && registered.status !== 409) {
        throw new Error(
            `register ${account.email} failed (${registered.status}): ${registered.body?.message}`,
        );
    }

    const loggedIn = await api("/auth/login", {
        method: "POST",
        body: { email: account.email, password: account.password },
    });
    if (loggedIn.status !== 200) {
        throw new Error(
            `login ${account.email} failed (${loggedIn.status}): ${loggedIn.body?.message}`,
        );
    }

    const token = loggedIn.data.accessToken;

    /*
     * Registration is skipped on the 409 above, so an account left over from
     * an earlier run keeps whatever it had -- and accounts created before
     * registerUser persisted fullName have none at all, which is exactly how
     * the demo ended up showing usernames where it means to show names. The
     * name is set every run rather than only on creation, so the workspace
     * looks the same however old the database is.
     */
    if (account.fullName && loggedIn.data.user?.fullName !== account.fullName) {
        await api("/auth/profile", {
            method: "PATCH",
            token,
            body: { fullName: account.fullName },
        });
    }

    return token;
}

const TASKS = [
    {
        title: "Audit current site performance",
        description:
            "Lighthouse run on the top ten pages; record LCP and CLS per template.",
        status: "done",
        subtasks: [
            { title: "Run Lighthouse on templates", isCompleted: true },
            { title: "Write up the findings", isCompleted: true },
        ],
    },
    {
        title: "Rebuild the pricing page",
        description:
            "New three-tier layout, annual/monthly toggle, and an FAQ block below the fold.",
        status: "in_progress",
        assignToTeammate: true,
        subtasks: [
            { title: "Copy review with marketing", isCompleted: true },
            { title: "Build the tier cards", isCompleted: false },
            { title: "Wire the billing toggle", isCompleted: false },
        ],
    },
    {
        title: "Migrate blog posts to the new CMS",
        description: "412 posts, including redirects for the old slugs.",
        status: "todo",
        subtasks: [
            { title: "Export the existing posts", isCompleted: false },
            { title: "Map the old slugs to new ones", isCompleted: false },
        ],
    },
    {
        title: "Set up analytics on the new funnel",
        status: "todo",
        assignToTeammate: true,
        subtasks: [],
    },
];

async function main() {
    const ownerToken = await ensureAccount(ACCOUNTS.owner);
    await ensureAccount(ACCOUNTS.teammate);
    console.log("✔ accounts ready");

    const existing = await api("/projects", { token: ownerToken });
    const match = existing.data?.find(
        (entry) => entry.project.name === PROJECT_NAME,
    );

    if (match && RESET) {
        await api(`/projects/${match.project._id}`, {
            method: "DELETE",
            token: ownerToken,
        });
        console.log("✔ removed the previous demo project");
    } else if (match) {
        console.log(
            `✔ demo project already exists: ${process.env.APP_URL ?? ""}/projects/${match.project._id}`,
        );
        console.log("  Re-run with --reset to rebuild it from scratch.");
        return;
    }

    const created = await api("/projects", {
        method: "POST",
        token: ownerToken,
        body: {
            name: PROJECT_NAME,
            description:
                "Marketing site rebuild — new pricing page, CMS migration, and analytics.",
        },
    });
    if (created.status !== 201) {
        throw new Error(
            `create project failed (${created.status}): ${created.body?.message}`,
        );
    }
    const projectId = created.data._id;
    console.log("✔ project created");

    await api(`/projects/${projectId}/members`, {
        method: "POST",
        token: ownerToken,
        body: { email: ACCOUNTS.teammate.email, role: "project_admin" },
    });

    const members = await api(`/projects/${projectId}/members`, {
        token: ownerToken,
    });
    const teammateId = members.data?.find(
        (entry) => entry.user.username === ACCOUNTS.teammate.username,
    )?.user._id;
    console.log("✔ members added");

    for (const spec of TASKS) {
        const task = await api(`/tasks/${projectId}`, {
            method: "POST",
            token: ownerToken,
            body: {
                title: spec.title,
                description: spec.description,
                status: spec.status,
                ...(spec.assignToTeammate && teammateId
                    ? { assignedTo: teammateId }
                    : {}),
            },
        });
        if (task.status !== 201) {
            throw new Error(
                `create task "${spec.title}" failed (${task.status}): ${task.body?.message}`,
            );
        }

        for (const sub of spec.subtasks) {
            const subtask = await api(
                `/tasks/${projectId}/t/${task.data._id}/subtasks`,
                {
                    method: "POST",
                    token: ownerToken,
                    body: { title: sub.title },
                },
            );
            if (sub.isCompleted) {
                await api(`/tasks/${projectId}/st/${subtask.data._id}`, {
                    method: "PUT",
                    token: ownerToken,
                    body: { isCompleted: true },
                });
            }
        }
    }
    console.log(`✔ ${TASKS.length} tasks with subtasks created`);

    await api(`/notes/${projectId}`, {
        method: "POST",
        token: ownerToken,
        body: {
            content:
                "Launch is gated on the pricing page and the CMS migration. " +
                "Everything else can ship behind a flag.",
        },
    });
    console.log("✔ note added");

    console.log("\nDone. Sign in with:");
    console.log(
        `  ${ACCOUNTS.owner.email} / ${ACCOUNTS.owner.password}  (admin)`,
    );
    console.log(
        `  ${ACCOUNTS.teammate.email} / ${ACCOUNTS.teammate.password}  (project admin)`,
    );
}

main().catch((error) => {
    console.error(`\n✖ ${error.message}`);
    process.exitCode = 1;
});
