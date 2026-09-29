# Backend One

Backend One is a Node.js and Express REST API for project-management workflows. It exposes authentication, health check, project, project-member, task, subtask, and project-note routes backed by MongoDB through Mongoose, with role-based access control enforced per project (`admin`, `project_admin`, `member`).

A React single-page client lives in `frontend/` and consumes that API: sign-in, a project list, and a per-project workspace with a task board, subtasks, attachments, notes, and member management. The client mirrors the server's role rules so it never offers an action the API would reject.

## Features

- Express server with JSON, URL-encoded, cookie, CORS, and static-file middleware.
- MongoDB connection using Mongoose.
- User registration with unique username/email checks and bcrypt password hashing.
- Email verification token generation and resend-verification flow.
- Login, logout, access-token refresh, and current-user lookup using JWTs.
- Forgot-password and reset-password flows using temporary hashed tokens.
- Request validation with `express-validator`.
- JWT authentication middleware that reads the access token from cookies or the `Authorization` header.
- Project creation, listing, lookup, update, and deletion route handlers.
- Project-member add, list, role-update, and removal route handlers, all requiring project membership.
- Task CRUD, task assignment, status tracking, and multi-file attachment uploads (via Multer, stored in Cloudinary when configured and on local disk otherwise), including removing a single attachment without deleting its task.
- Subtask CRUD, with member access limited to toggling completion (only admin/project_admin can create, delete, or rename subtasks).
- Project notes CRUD, restricted to admin for create/update/delete; all project roles can read.
- Mongoose schemas for users, projects, project members, tasks, subtasks, and project notes.
- Project-scoped resource authorization: task, subtask, and note lookups are constrained to the project in the URL, not just the child's own id.
- Task assignees are checked against project membership, so a task cannot be assigned to someone who has no way to open the project it lives in.
- Every project keeps at least one admin: demoting or removing the last one is refused with a 409, because no other role can rename, delete, or re-staff a project.
- Upload allowlist (MIME plus extension must agree), randomised stored filenames, and uploads served as non-executable attachments.
- Cascading project deletes: removing a project also removes its members, tasks, subtasks, notes, and stored attachment blobs.
- Security headers via `helmet`, and per-IP rate limiting with a stricter budget on authentication endpoints.
- Hardened auth cookies (`httpOnly`, `SameSite`, and a `maxAge` matching the token's own expiry).
- Changing a password ends every session: both the reset and the signed-in change clear the stored refresh token, so credentials issued before the change stop working.
- Centralized JSON error handling for `ApiError`, Multer upload errors, Mongo duplicate keys, Mongoose validation/cast errors, and malformed ObjectIds.

### Web client (`frontend/`)

- Bearer-token session with a single-flight refresh, so several queries failing at once cannot spend the same rotating refresh token twice.
- Forgot-password and reset-password screens. `FORGOT_PASSWORD_REDIRECT_URL` points the emailed link at `/reset-password/<token>` in the client, so that route has to exist for the flow the API implements to be reachable at all.
- Email-verification screen, plus an in-app banner that offers an unverified account a fresh link while it still has a session to request one with.
- Account screen showing the signed-in profile and verification state, with a display-name form and a change-password form that explains up front that every session ends — including the current one — and signs the user out afterwards.
- Project list linking into a per-project workspace with Tasks, Notes, Members, and (for admins) Settings tabs.
- Task board grouped by status, with optimistic status changes that roll back to the previous board when the server refuses the move.
- Board search and assignee filter, including "assigned to me" and "unassigned", applied in the browser because `GET /tasks/:projectId` returns the whole project in one response and takes no query parameters.
- Task slide-over: description, assignee, attachments with sizes, and subtasks that any member may tick off.
- Task create and edit send JSON when no files are selected and multipart when they are, so an empty assignee is omitted rather than failing the `isMongoId` validator.
- Member management with add-by-email and role changes; your own row is deliberately not editable, so the last admin cannot lock themselves out.
- Role-aware UI throughout: a plain member sees no task controls, and notes stay read-only for anyone who is not a project `admin`.
- Two-step inline confirmation for destructive actions instead of `window.confirm`, which some embedded browsers suppress outright.

## Tech Stack

| Category       | Technology                                             |
| -------------- | ------------------------------------------------------ |
| Languages      | JavaScript, Node.js                                    |
| Frameworks     | Express                                                |
| Database       | MongoDB                                                |
| ODM            | Mongoose                                               |
| Authentication | JSON Web Tokens, bcrypt                                |
| Validation     | express-validator                                      |
| Email          | Nodemailer, Mailgen, Mailtrap-style SMTP configuration |
| File Uploads   | Multer, Cloudinary                                     |
| Middleware     | cookie-parser, cors, dotenv                            |
| Tools          | npm, nodemon, Prettier                                 |

## Project Structure

```text
.
|-- public/
|   `-- images/                  # Static image/upload directory
|-- src/
|   |-- app.js                   # Express app configuration and route mounting
|   |-- index.js                 # Environment loading, database connection, server startup
|   |-- controllers/             # Route handler logic
|   |-- db/                      # MongoDB connection helper
|   |-- middlewares/             # Auth, validation, and upload middleware
|   |-- models/                  # Mongoose schemas and models
|   |-- routes/                  # Express route definitions
|   |-- utils/                   # API response/error helpers, constants, email utilities
|   `-- validators/              # express-validator request validators
|-- frontend/                    # React + Vite single-page client
|   |-- src/
|   |   |-- components/          # UI kit and per-project panels
|   |   |-- context/             # Auth provider and session restore
|   |   |-- lib/                 # API client, shared types, display helpers
|   |   |-- routes/              # Login, Register, Projects, ProjectDetail
|   |   `-- test/                # Vitest setup and render helpers
|   `-- vitest.config.ts         # jsdom test config, separate from vite.config.ts
|-- scripts/
|   |-- verify.mjs               # End-to-end backend smoke test
|   `-- seed-demo.mjs            # Populates a running server with demo data
|-- test/                        # Ignored reference copy and PRD, not active test specs
|-- package.json                 # Scripts and dependency metadata
|-- package-lock.json            # Locked npm dependency tree
|-- CHANGELOG.md                 # Short project change notes
`-- README.md                    # Project documentation
```

## Installation

1. Clone the repository.

```bash
git clone <repository-url>
cd Backend_One
```

2. Install dependencies.

```bash
npm install
```

3. Create a `.env` file in the project root and add the variables listed below.

4. Make sure MongoDB is running and that `MONGO_URI` points to a reachable database.

5. If you plan to use email verification or password reset, configure the SMTP variables expected by `src/utils/mail.js`.

## Environment Variables

The application loads environment variables from `.env` in the project root.

| Variable                                                                 | Required           | Used By                     | Description                                                                                                                                                                                                                      |
| ------------------------------------------------------------------------ | ------------------ | --------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `MONGO_URI`                                                              | Yes                | `src/db/index.js`           | MongoDB connection string.                                                                                                                                                                                                       |
| `PORT`                                                                   | No                 | `src/index.js`              | Server port. Defaults to `3000`.                                                                                                                                                                                                 |
| `CORS_ORIGIN`                                                            | No                 | `src/app.js`                | Comma-separated list of allowed origins. Unset or `*` reflects the caller's origin and logs a startup warning, since `*` alongside `credentials: true` lets any site send authenticated requests.                                |
| `ACCESS_TOKEN_SECRET`                                                    | Yes                | User model, auth middleware | Secret used to sign and verify access tokens.                                                                                                                                                                                    |
| `ACCESS_TOKEN_EXPIRY`                                                    | Yes                | User model                  | Access-token lifetime, such as `1d` or `15m`.                                                                                                                                                                                    |
| `REFRESH_TOKEN_SECRET`                                                   | Yes                | User model, auth controller | Secret used to sign and verify refresh tokens.                                                                                                                                                                                   |
| `REFRESH_TOKEN_EXPIRY`                                                   | Yes                | User model                  | Refresh-token lifetime, such as `10d`.                                                                                                                                                                                           |
| `FORGOT_PASSWORD_REDIRECT_URL`                                           | Yes                | Auth controller             | Frontend URL used to build password-reset links. The token is appended as a path segment, so this must match the client's `/reset-password/:token` route.                                                                        |
| `EMAIL_VERIFICATION_REDIRECT_URL`                                        | No                 | Auth controller             | Frontend URL used to build email-verification links, same convention. Unset, the email links straight at the API endpoint, which answers JSON -- fine for an API-only deployment, a dead end for anyone opening it in a browser. |
| `MAILTRAP_SMTP_HOST`                                                     | Yes, for email     | Mail utility                | SMTP host for outgoing verification/reset emails.                                                                                                                                                                                |
| `MAILTRAP_SMTP_PORT`                                                     | Yes, for email     | Mail utility                | SMTP port for outgoing email.                                                                                                                                                                                                    |
| `MAILTRAP_SMTP_USER`                                                     | Yes, for email     | Mail utility                | SMTP username.                                                                                                                                                                                                                   |
| `MAILTRAP_SMTP_PASS`                                                     | Yes, for email     | Mail utility                | SMTP password.                                                                                                                                                                                                                   |
| `SERVER_URL`                                                             | Yes                | Storage util                | Base URL used to build attachment links for the local storage driver (e.g. `http://localhost:8000`). Also used by `scripts/verify.mjs`.                                                                                          |
| `CLOUDINARY_CLOUD_NAME` / `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` | Yes, in production | Storage util                | When all three are set, attachments upload to Cloudinary. With any missing, the app writes to `public/images` instead. Required on any deployed host, whose filesystem is ephemeral.                                             |
| `NODE_ENV`                                                               | No                 | Cookie options              | When set to `production`, auth cookies are sent with `secure: true`. Leave unset for local HTTP testing.                                                                                                                         |
| `COOKIE_SAMESITE`                                                        | No                 | Cookie options              | `strict` (default), `lax`, or `none`. Use `none` only for a cross-site frontend; it forces `secure: true` regardless of `NODE_ENV`.                                                                                              |
| `REQUIRE_EMAIL_VERIFICATION`                                             | No                 | Auth controller             | When `"true"`, login rejects users whose email is unverified with a 403. Defaults to off.                                                                                                                                        |
| `RATE_LIMIT_ENABLED`                                                     | No                 | Rate limit middleware       | Set to `"false"` to disable all rate limiting. Needed when running `scripts/verify.mjs` repeatedly.                                                                                                                              |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS`                                | No                 | Rate limit middleware       | Global budget per IP. Defaults to 300 requests per 15 minutes.                                                                                                                                                                   |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS`                      | No                 | Rate limit middleware       | Budget for auth endpoints. Defaults to 20 _failed_ attempts per 15 minutes; successful logins are not counted.                                                                                                                   |
| `TRUST_PROXY`                                                            | No                 | `src/app.js`                | Number of proxy hops to trust. Required behind a reverse proxy so rate limiting sees the real client IP. Leave unset locally.                                                                                                    |

Example `.env` shape:

```env
MONGO_URI=mongodb://127.0.0.1:27017/backend_one
PORT=3000
CORS_ORIGIN=http://localhost:5173

ACCESS_TOKEN_SECRET=replace-with-a-strong-secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=replace-with-a-strong-secret
REFRESH_TOKEN_EXPIRY=10d

FORGOT_PASSWORD_REDIRECT_URL=http://localhost:5173/reset-password
EMAIL_VERIFICATION_REDIRECT_URL=http://localhost:5173/verify-email

MAILTRAP_SMTP_HOST=sandbox.smtp.mailtrap.io
MAILTRAP_SMTP_PORT=2525
MAILTRAP_SMTP_USER=replace-with-smtp-user
MAILTRAP_SMTP_PASS=replace-with-smtp-password

SERVER_URL=http://localhost:3000

# Optional security tuning (defaults shown)
COOKIE_SAMESITE=strict
REQUIRE_EMAIL_VERIFICATION=false
RATE_LIMIT_ENABLED=true
```

Note: `mail.js` catches SMTP errors and logs them rather than throwing, so registration/password-reset requests still return success even if the email itself fails to send (e.g. wrong credentials, or Mailtrap's free-tier per-second rate limit). Check the server console when debugging email delivery.

## Running the Project

Start the development server with nodemon:

```bash
npm run dev
```

Start the server with Node:

```bash
npm start
```

By default, the server listens on:

```text
http://localhost:3000
```

### Web client

```bash
cd frontend
npm install
npm run dev          # http://localhost:5173
```

The client reads its API base URL from `VITE_API_URL` (see `frontend/.env.example`); it
defaults to `http://localhost:8000/api/v1`. Set `CORS_ORIGIN=http://localhost:5173` in the
server's `.env` so the browser will send credentialed requests.

### Demo data

With the server running, `scripts/seed-demo.mjs` creates two accounts, a project with members
in two roles, four tasks spread across every status with subtasks, and a note — enough to see
every screen populated:

```bash
npm run seed           # add the demo workspace if it is not already there
npm run seed -- --reset   # rebuild it from scratch
```

It prints the credentials to sign in with when it finishes.

## API Endpoints

The current Express app mounts routes under `/api/v1` for health checks, authentication, and projects.

| Method   | Endpoint                                                       | Auth Required | Description                                                                                                 |
| -------- | -------------------------------------------------------------- | ------------- | ----------------------------------------------------------------------------------------------------------- |
| `GET`    | `/`                                                            | No            | Returns a welcome message.                                                                                  |
| `GET`    | `/api/v1/healthcheck`                                          | No            | Returns server health status.                                                                               |
| `POST`   | `/api/v1/auth/register`                                        | No            | Registers a user and sends an email verification message.                                                   |
| `POST`   | `/api/v1/auth/login`                                           | No            | Authenticates a user and returns access/refresh tokens.                                                     |
| `GET`    | `/api/v1/auth/verify-email/:verificationToken`                 | No            | Verifies a user's email with a temporary token.                                                             |
| `POST`   | `/api/v1/auth/refresh-token`                                   | No            | Refreshes the access token using a refresh token from cookies or the request body.                          |
| `POST`   | `/api/v1/auth/forgot-password`                                 | No            | Sends a password-reset email for a registered account.                                                      |
| `POST`   | `/api/v1/auth/reset-password/:resetToken`                      | No            | Resets a password using a temporary reset token.                                                            |
| `POST`   | `/api/v1/auth/logout`                                          | Yes           | Clears stored refresh token and auth cookies.                                                               |
| `GET`    | `/api/v1/auth/current-user`                                    | Yes           | Returns the authenticated user.                                                                             |
| `POST`   | `/api/v1/auth/change-password`                                 | Yes           | Changes the authenticated user's password.                                                                  |
| `PATCH`  | `/api/v1/auth/profile`                                         | Yes           | Updates the authenticated user's display name. Username and email are identity and are not writable here.   |
| `POST`   | `/api/v1/auth/resend-email-verification`                       | Yes           | Sends another email verification message.                                                                   |
| `GET`    | `/api/v1/projects`                                             | Yes           | Lists projects associated with the authenticated user.                                                      |
| `POST`   | `/api/v1/projects`                                             | Yes           | Creates a project and adds the creator as an admin member.                                                  |
| `GET`    | `/api/v1/projects/:projectId`                                  | Yes           | Gets a project by ID.                                                                                       |
| `PUT`    | `/api/v1/projects/:projectId`                                  | Yes           | Updates a project by ID. Intended for admin users.                                                          |
| `DELETE` | `/api/v1/projects/:projectId`                                  | Yes           | Deletes a project and cascades to its members, tasks, subtasks, notes, and attachments. Admin only.         |
| `GET`    | `/api/v1/projects/:projectId/members`                          | Yes           | Lists members for a project.                                                                                |
| `POST`   | `/api/v1/projects/:projectId/members`                          | Yes           | Adds or updates a project member by email and role. Intended for admin users.                               |
| `PUT`    | `/api/v1/projects/:projectId/members/:userId`                  | Yes           | Updates a project member role. Admin only.                                                                  |
| `DELETE` | `/api/v1/projects/:projectId/members/:userId`                  | Yes           | Removes a user from a project. Admin only.                                                                  |
| `GET`    | `/api/v1/tasks/:projectId`                                     | Yes           | Lists tasks in a project. Any project role.                                                                 |
| `POST`   | `/api/v1/tasks/:projectId`                                     | Yes           | Creates a task, optionally with file attachments (multipart `attachments` field). Admin/project_admin only. |
| `GET`    | `/api/v1/tasks/:projectId/t/:taskId`                           | Yes           | Gets a task by ID, with assignee and subtasks populated. Any project role.                                  |
| `PUT`    | `/api/v1/tasks/:projectId/t/:taskId`                           | Yes           | Updates a task; new attachments are appended. Admin/project_admin only.                                     |
| `DELETE` | `/api/v1/tasks/:projectId/t/:taskId`                           | Yes           | Deletes a task and its subtasks. Admin/project_admin only.                                                  |
| `DELETE` | `/api/v1/tasks/:projectId/t/:taskId/attachments/:attachmentId` | Yes           | Removes one attachment from a task and deletes its stored blob. Admin/project_admin only.                   |
| `POST`   | `/api/v1/tasks/:projectId/t/:taskId/subtasks`                  | Yes           | Creates a subtask. Admin/project_admin only.                                                                |
| `PUT`    | `/api/v1/tasks/:projectId/st/:subTaskId`                       | Yes           | Updates a subtask. Any project role may toggle `isCompleted`; only admin/project_admin may change `title`.  |
| `DELETE` | `/api/v1/tasks/:projectId/st/:subTaskId`                       | Yes           | Deletes a subtask. Admin/project_admin only.                                                                |
| `GET`    | `/api/v1/notes/:projectId`                                     | Yes           | Lists notes in a project. Any project role.                                                                 |
| `POST`   | `/api/v1/notes/:projectId`                                     | Yes           | Creates a note. Admin only.                                                                                 |
| `GET`    | `/api/v1/notes/:projectId/n/:noteId`                           | Yes           | Gets a note by ID. Any project role.                                                                        |
| `PUT`    | `/api/v1/notes/:projectId/n/:noteId`                           | Yes           | Updates a note. Admin only.                                                                                 |
| `DELETE` | `/api/v1/notes/:projectId/n/:noteId`                           | Yes           | Deletes a note. Admin only.                                                                                 |

## Architecture Overview

`src/index.js` loads `.env` via a leading `import "dotenv/config"`, connects to MongoDB, and starts the Express server. The import must come first: ES module imports are evaluated before any statement in the file, so calling `dotenv.config()` further down would leave `process.env` empty while `app.js` and its dependencies are still being loaded. `src/app.js` configures shared middleware, serves static files from `public`, applies CORS settings, and mounts the healthcheck, authentication, and project routers.

Requests flow from route files into validators, middleware, and controller functions. Controllers use Mongoose models to read and write MongoDB documents, then return a consistent `ApiResponse` object. Errors are represented with `ApiError`, async route handlers are wrapped by `asyncHandler`, and a centralized error-handling middleware (last `app.use` in `src/app.js`) serializes `ApiError` instances, Multer upload errors (413 for oversized files, 400 otherwise), Mongo duplicate-key conflicts (409), Mongoose `ValidationError`/`CastError`, and BSON `ObjectId` cast errors into consistent JSON instead of falling through to Express's default HTML error page. Ordering in that handler is load-bearing: `ApiError` is matched first, so a 415 raised by the upload filter keeps the standard envelope.

Authentication is based on signed JWT access and refresh tokens. Passwords are hashed in the user model before save, refresh tokens are stored on the user document, and protected routes use `verifyJWT` to load the authenticated user from either an HTTP-only cookie or a bearer token.

Project access is modeled through the `ProjectMember` collection, which connects users to projects with one of three roles: `admin`, `project_admin`, or `member`. Route-level `validateProjectPermission` middleware enforces which roles may reach each project/task/note endpoint; `updateSubTask` additionally branches in the controller so any project role can toggle a subtask's `isCompleted` while only `admin`/`project_admin` can rename it. Authorization is enforced twice over: `validateProjectPermission` decides whether the caller may reach the project at all, and each controller then scopes its query to that same `projectId` so a child resource belonging to a different project cannot be reached through it. This RBAC behavior, including cross-project access denial, is exercised by `scripts/verify.mjs`.

## Screenshots

This is a backend API project, so no application UI screenshots are available in the repository.

| Screenshot          | Placeholder                                       |
| ------------------- | ------------------------------------------------- |
| API client example  | Add a Postman, Insomnia, or curl screenshot here. |
| MongoDB collections | Add a database screenshot here if useful.         |

## Testing / Verification

`scripts/verify.mjs` is an end-to-end smoke test (Node's built-in `node:test` + `fetch`, no extra dependencies) that runs against a live `npm run dev` server and the real MongoDB database configured in `.env`. It registers two users, exercises project/task/subtask/note CRUD and RBAC (including cross-project access and the member-vs-admin subtask permission split), asserts that deleting a project leaves no orphaned rows behind, and cleans up everything it creates.

It also runs on every push and pull request via `.github/workflows/ci.yml`, against a real MongoDB service container on `ubuntu-latest`. That workflow additionally imports the whole module graph on a case-sensitive filesystem, which catches import-path casing mistakes that a Windows or macOS machine cannot detect locally.

```bash
npm run dev                  # in one terminal
RATE_LIMIT_ENABLED=false npm run verify   # in another, once the server is up
```

Disabling the rate limiter matters: the script makes several auth calls per run and would
otherwise exhaust the auth budget after a few consecutive runs.

### Linting

Both projects lint with [oxlint](https://oxc.rs/docs/guide/usage/linter.html):

```bash
npm run lint            # src/ and scripts/
cd frontend && npm run lint
```

oxlint rather than ESLint for one concrete reason: this project is on TypeScript
7, and typescript-eslint refuses to load against it outright — not a peer
warning but a thrown error, tracked in typescript-eslint#10940. Without its
parser, ESLint cannot read a `.tsx` file at all, which rules out
`react-hooks/rules-of-hooks` and `exhaustive-deps` — the rules actually worth
having here. oxlint parses TypeScript itself and implements both.

The trade-off is that oxlint has no type-aware rules. `tsc --noEmit` covers that
ground and runs in the same CI job.

### Backend unit tests

The pieces that need neither a server nor a database run on their own:

```bash
npm run test:unit
```

The script names each test file explicitly. `node --test src/` is not an
alternative: on Node 22 a directory argument is resolved as a module, so `src/`
becomes `src/index.js`, which boots a real server and never exits; on Node 20 the
same argument is treated as a directory to search. Glob arguments only work from
Node 21 on, which is above this project's `engines` floor.

### Frontend tests

The client has its own Vitest suite (jsdom + Testing Library). It needs no database and no
running API: the request layer is stubbed, so the tests assert on component behaviour rather
than on the network.

```bash
cd frontend
npm test          # single run
npm run test:watch
```

Coverage is aimed at the things a typecheck cannot catch — that tasks land in the right status
column, that a plain member is offered no task controls and no Settings tab, that an
optimistic status change rolls back when the server refuses it, that a task with no
attachments is sent as JSON rather than multipart, and that the reset-password route stays
reachable for a browser that still holds a session.

`src/lib/api.test.ts` covers the client's own auth machinery against a stubbed `fetch`: the 401
retry, the single-flight refresh, and that a failed refresh clears the session. That module is
mocked wholesale by every other test file, so nothing else exercises it — and it holds the
subtlest logic in the client. The single-flight assertion was confirmed to fail when the
memoisation is removed, since a test that cannot fail proves nothing.

`vitest.config.ts` is deliberately separate from `vite.config.ts`: Vitest bundles its own copy
of Vite, and a single config importing both `vitest/config` and the Vite 8 plugins types the
plugin array against the wrong copy and fails `tsc --noEmit`.

## Security Notes

- **Project-scoped resource access.** Every task, subtask, and note lookup is constrained to the
  `:projectId` in the URL, not just the child's own id. A mismatch returns **404 rather than 403**,
  so the response cannot be used to probe whether a resource exists in another project.
  `scripts/verify.mjs` covers this directly.
- **A password change ends every session.** `resetForgotPassword` and
  `changeCurrentPassword` both clear the stored refresh token. A reset is what someone does when
  they believe their account is compromised, so it has to actually evict whoever else is holding
  it — without this, a refresh token minted before the reset kept renewing itself for its full
  lifetime. Access tokens are stateless JWTs and cannot be revoked individually, so one already
  issued stays valid until it expires; clearing the refresh token caps that residual window at a
  single `ACCESS_TOKEN_EXPIRY`. `scripts/verify.mjs` asserts both paths.
- **Every project keeps an admin.** `updateMemberRole` and `deleteMember` refuse a change that
  would leave a project with no `admin`. This is a liveness property rather than a
  confidentiality one, and it is unrecoverable if violated: renaming, deleting, adding a member,
  and changing a role are all gated on `admin`, so an admin-less project cannot be repaired
  through the API at all. Because the count and the write are separate round trips, each path
  re-counts afterwards and undoes its own change if a concurrent demotion crossed the line --
  a transaction would be tidier but needs a replica set, and CI runs a standalone `mongod`.
- **Assignees must be members.** `express-validator` can only see the request body, so it can
  check that `assignedTo` is a well-formed ObjectId and nothing more. `createTask` and
  `updateTask` additionally resolve it against `ProjectMember`, before any attachment is
  written -- a rejection after the upload would orphan the blobs with no row left to delete
  them by.
- **Local deletes cannot escape the upload directory.** Stored keys are UUIDs the server
  generates, so nothing attacker-controlled normally reaches `fs.unlink`. `resolveLocalPath` in
  `src/utils/storage.js` checks anyway, because the paths that bypass that are real: a row
  written by an older version, one restored from a backup, or a database edited by hand. A key
  of `../../src/app.js` would otherwise resolve to a live file and delete it. Covered by
  `npm run test:unit`.
- **Upload allowlist.** `src/middlewares/multer.middleware.js` accepts a file only when its MIME
  type is known _and_ its extension belongs to that type, which also rejects double-extension
  tricks like `a.txt.html`. SVG is deliberately excluded because it can carry inline `<script>`.
  Stored filenames are random UUIDs, and everything under `public/` is served with
  `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
- **Storage driver.** Multer buffers uploads in memory and `src/utils/storage.js` decides where the
  bytes land: Cloudinary when its three credentials are present, `public/images` otherwise. The
  filter above runs before either driver, so a rejected file is never written anywhere. Each stored
  attachment records the `provider` and `key` needed to delete it again — without those, removing a
  task or project would leave its blobs orphaned in a paid account indefinitely.
- **Account enumeration.** Login answers `401 Invalid credentials` for both an unknown address and
  a wrong password, and forgot-password always returns the same 200. Note one residual gap: a
  request for a nonexistent user skips bcrypt and so returns measurably faster. Closing that timing
  side-channel would mean comparing against a dummy hash on the miss path.
- **CORS.** `CORS_ORIGIN=*` combined with `credentials: true` lets any origin send authenticated
  requests; the server logs a warning at startup. Set an explicit comma-separated origin list
  before deploying.
- **Tokens are returned in the login response body as well as in httpOnly cookies.** This is a
  deliberate dual-client design (cookies for browsers, `Authorization: Bearer` for API and mobile
  clients), but it does mean an XSS bug could read a token from the response. A browser-only
  deployment should drop the body tokens.

## Future Improvements

- Support removing an individual attachment from a task; today they can only be appended, or removed wholesale with the task.
- Expand backend coverage beyond the smoke-test script, particularly per-endpoint validation edge cases and token expiry/refresh behaviour.
- Drag-and-drop on the task board. The status dropdown on each card is keyboard-accessible and works everywhere, so dragging would be an addition to it rather than a replacement.
- Avatar upload. The user model carries an `avatar` field with a placeholder default, and no endpoint replaces it; the display name is editable through `PATCH /api/v1/auth/profile`.

## Learning Outcomes

This project demonstrates how to organize an Express API with routes, controllers, middleware, validators, utilities, and Mongoose models. A developer can learn JWT-based authentication, password hashing, token-based email flows, request validation, role-oriented data modeling, and basic MongoDB relationships for a project-management backend.

## Contributing

Contributions are welcome.

1. Fork the repository.
2. Create a feature branch.
3. Make a focused change with clear naming and formatting.
4. Run the project locally with `npm run dev`.
5. Open a pull request describing the change and any manual testing performed.

Run `node scripts/verify.mjs` against a local dev server before opening a PR, and include the result in your description along with any manual verification notes.

## License

This project is licensed under the ISC License.
