# Backend One

Backend One is a Node.js and Express REST API for project-management workflows. It exposes authentication, health check, project, project-member, task, subtask, and project-note routes backed by MongoDB through Mongoose, with role-based access control enforced per project (`admin`, `project_admin`, `member`).

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
- Task CRUD, task assignment, status tracking, and multi-file attachment uploads (via Multer, stored under `public/images`).
- Subtask CRUD, with member access limited to toggling completion (only admin/project_admin can create, delete, or rename subtasks).
- Project notes CRUD, restricted to admin for create/update/delete; all project roles can read.
- Mongoose schemas for users, projects, project members, tasks, subtasks, and project notes.
- Project-scoped resource authorization: task, subtask, and note lookups are constrained to the project in the URL, not just the child's own id.
- Upload allowlist (MIME plus extension must agree), randomised stored filenames, and uploads served as non-executable attachments.
- Security headers via `helmet`, and per-IP rate limiting with a stricter budget on authentication endpoints.
- Hardened auth cookies (`httpOnly`, `SameSite`, and a `maxAge` matching the token's own expiry).
- Centralized JSON error handling for `ApiError`, Multer upload errors, Mongo duplicate keys, Mongoose validation/cast errors, and malformed ObjectIds.

## Tech Stack

| Category | Technology |
| --- | --- |
| Languages | JavaScript, Node.js |
| Frameworks | Express |
| Database | MongoDB |
| ODM | Mongoose |
| Authentication | JSON Web Tokens, bcrypt |
| Validation | express-validator |
| Email | Nodemailer, Mailgen, Mailtrap-style SMTP configuration |
| File Uploads | Multer |
| Middleware | cookie-parser, cors, dotenv |
| Tools | npm, nodemon, Prettier |

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

| Variable | Required | Used By | Description |
| --- | --- | --- | --- |
| `MONGO_URI` | Yes | `src/db/index.js` | MongoDB connection string. |
| `PORT` | No | `src/index.js` | Server port. Defaults to `3000`. |
| `CORS_ORIGIN` | No | `src/app.js` | Comma-separated list of allowed origins. Unset or `*` reflects the caller's origin and logs a startup warning, since `*` alongside `credentials: true` lets any site send authenticated requests. |
| `ACCESS_TOKEN_SECRET` | Yes | User model, auth middleware | Secret used to sign and verify access tokens. |
| `ACCESS_TOKEN_EXPIRY` | Yes | User model | Access-token lifetime, such as `1d` or `15m`. |
| `REFRESH_TOKEN_SECRET` | Yes | User model, auth controller | Secret used to sign and verify refresh tokens. |
| `REFRESH_TOKEN_EXPIRY` | Yes | User model | Refresh-token lifetime, such as `10d`. |
| `FORGOT_PASSWORD_REDIRECT_URL` | Yes | Auth controller | Frontend URL used to build password-reset links. |
| `MAILTRAP_SMTP_HOST` | Yes, for email | Mail utility | SMTP host for outgoing verification/reset emails. |
| `MAILTRAP_SMTP_PORT` | Yes, for email | Mail utility | SMTP port for outgoing email. |
| `MAILTRAP_SMTP_USER` | Yes, for email | Mail utility | SMTP username. |
| `MAILTRAP_SMTP_PASS` | Yes, for email | Mail utility | SMTP password. |
| `SERVER_URL` | Yes | Task controller | Base URL used to build task attachment links (e.g. `http://localhost:8000`). Also used by `scripts/verify.mjs`. |
| `NODE_ENV` | No | Cookie options | When set to `production`, auth cookies are sent with `secure: true`. Leave unset for local HTTP testing. |
| `COOKIE_SAMESITE` | No | Cookie options | `strict` (default), `lax`, or `none`. Use `none` only for a cross-site frontend; it forces `secure: true` regardless of `NODE_ENV`. |
| `REQUIRE_EMAIL_VERIFICATION` | No | Auth controller | When `"true"`, login rejects users whose email is unverified with a 403. Defaults to off. |
| `RATE_LIMIT_ENABLED` | No | Rate limit middleware | Set to `"false"` to disable all rate limiting. Needed when running `scripts/verify.mjs` repeatedly. |
| `RATE_LIMIT_MAX` / `RATE_LIMIT_WINDOW_MS` | No | Rate limit middleware | Global budget per IP. Defaults to 300 requests per 15 minutes. |
| `AUTH_RATE_LIMIT_MAX` / `AUTH_RATE_LIMIT_WINDOW_MS` | No | Rate limit middleware | Budget for auth endpoints. Defaults to 20 *failed* attempts per 15 minutes; successful logins are not counted. |
| `TRUST_PROXY` | No | `src/app.js` | Number of proxy hops to trust. Required behind a reverse proxy so rate limiting sees the real client IP. Leave unset locally. |

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

## API Endpoints

The current Express app mounts routes under `/api/v1` for health checks, authentication, and projects.

| Method | Endpoint | Auth Required | Description |
| --- | --- | --- | --- |
| `GET` | `/` | No | Returns a welcome message. |
| `GET` | `/api/v1/healthcheck` | No | Returns server health status. |
| `POST` | `/api/v1/auth/register` | No | Registers a user and sends an email verification message. |
| `POST` | `/api/v1/auth/login` | No | Authenticates a user and returns access/refresh tokens. |
| `GET` | `/api/v1/auth/verify-email/:verificationToken` | No | Verifies a user's email with a temporary token. |
| `POST` | `/api/v1/auth/refresh-token` | No | Refreshes the access token using a refresh token from cookies or the request body. |
| `POST` | `/api/v1/auth/forgot-password` | No | Sends a password-reset email for a registered account. |
| `POST` | `/api/v1/auth/reset-password/:resetToken` | No | Resets a password using a temporary reset token. |
| `POST` | `/api/v1/auth/logout` | Yes | Clears stored refresh token and auth cookies. |
| `GET` | `/api/v1/auth/current-user` | Yes | Returns the authenticated user. |
| `POST` | `/api/v1/auth/change-password` | Yes | Changes the authenticated user's password. |
| `POST` | `/api/v1/auth/resend-email-verification` | Yes | Sends another email verification message. |
| `GET` | `/api/v1/projects` | Yes | Lists projects associated with the authenticated user. |
| `POST` | `/api/v1/projects` | Yes | Creates a project and adds the creator as an admin member. |
| `GET` | `/api/v1/projects/:projectId` | Yes | Gets a project by ID. |
| `PUT` | `/api/v1/projects/:projectId` | Yes | Updates a project by ID. Intended for admin users. |
| `DELETE` | `/api/v1/projects/:projectId` | Yes | Deletes a project by ID. Intended for admin users. |
| `GET` | `/api/v1/projects/:projectId/members` | Yes | Lists members for a project. |
| `POST` | `/api/v1/projects/:projectId/members` | Yes | Adds or updates a project member by email and role. Intended for admin users. |
| `PUT` | `/api/v1/projects/:projectId/members/:userId` | Yes | Updates a project member role. Admin only. |
| `DELETE` | `/api/v1/projects/:projectId/members/:userId` | Yes | Removes a user from a project. Admin only. |
| `GET` | `/api/v1/tasks/:projectId` | Yes | Lists tasks in a project. Any project role. |
| `POST` | `/api/v1/tasks/:projectId` | Yes | Creates a task, optionally with file attachments (multipart `attachments` field). Admin/project_admin only. |
| `GET` | `/api/v1/tasks/:projectId/t/:taskId` | Yes | Gets a task by ID, with assignee and subtasks populated. Any project role. |
| `PUT` | `/api/v1/tasks/:projectId/t/:taskId` | Yes | Updates a task; new attachments are appended. Admin/project_admin only. |
| `DELETE` | `/api/v1/tasks/:projectId/t/:taskId` | Yes | Deletes a task and its subtasks. Admin/project_admin only. |
| `POST` | `/api/v1/tasks/:projectId/t/:taskId/subtasks` | Yes | Creates a subtask. Admin/project_admin only. |
| `PUT` | `/api/v1/tasks/:projectId/st/:subTaskId` | Yes | Updates a subtask. Any project role may toggle `isCompleted`; only admin/project_admin may change `title`. |
| `DELETE` | `/api/v1/tasks/:projectId/st/:subTaskId` | Yes | Deletes a subtask. Admin/project_admin only. |
| `GET` | `/api/v1/notes/:projectId` | Yes | Lists notes in a project. Any project role. |
| `POST` | `/api/v1/notes/:projectId` | Yes | Creates a note. Admin only. |
| `GET` | `/api/v1/notes/:projectId/n/:noteId` | Yes | Gets a note by ID. Any project role. |
| `PUT` | `/api/v1/notes/:projectId/n/:noteId` | Yes | Updates a note. Admin only. |
| `DELETE` | `/api/v1/notes/:projectId/n/:noteId` | Yes | Deletes a note. Admin only. |

## Architecture Overview

`src/index.js` loads `.env` via a leading `import "dotenv/config"`, connects to MongoDB, and starts the Express server. The import must come first: ES module imports are evaluated before any statement in the file, so calling `dotenv.config()` further down would leave `process.env` empty while `app.js` and its dependencies are still being loaded. `src/app.js` configures shared middleware, serves static files from `public`, applies CORS settings, and mounts the healthcheck, authentication, and project routers.

Requests flow from route files into validators, middleware, and controller functions. Controllers use Mongoose models to read and write MongoDB documents, then return a consistent `ApiResponse` object. Errors are represented with `ApiError`, async route handlers are wrapped by `asyncHandler`, and a centralized error-handling middleware (last `app.use` in `src/app.js`) serializes `ApiError` instances, Multer upload errors (413 for oversized files, 400 otherwise), Mongo duplicate-key conflicts (409), Mongoose `ValidationError`/`CastError`, and BSON `ObjectId` cast errors into consistent JSON instead of falling through to Express's default HTML error page. Ordering in that handler is load-bearing: `ApiError` is matched first, so a 415 raised by the upload filter keeps the standard envelope.

Authentication is based on signed JWT access and refresh tokens. Passwords are hashed in the user model before save, refresh tokens are stored on the user document, and protected routes use `verifyJWT` to load the authenticated user from either an HTTP-only cookie or a bearer token.

Project access is modeled through the `ProjectMember` collection, which connects users to projects with one of three roles: `admin`, `project_admin`, or `member`. Route-level `validateProjectPermission` middleware enforces which roles may reach each project/task/note endpoint; `updateSubTask` additionally branches in the controller so any project role can toggle a subtask's `isCompleted` while only `admin`/`project_admin` can rename it. Authorization is enforced twice over: `validateProjectPermission` decides whether the caller may reach the project at all, and each controller then scopes its query to that same `projectId` so a child resource belonging to a different project cannot be reached through it. This RBAC behavior, including cross-project access denial, is exercised by `scripts/verify.mjs`.

## Screenshots

This is a backend API project, so no application UI screenshots are available in the repository.

| Screenshot | Placeholder |
| --- | --- |
| API client example | Add a Postman, Insomnia, or curl screenshot here. |
| MongoDB collections | Add a database screenshot here if useful. |

## Testing / Verification

`scripts/verify.mjs` is an end-to-end smoke test (Node's built-in `node:test` + `fetch`, no extra dependencies) that runs against a live `npm run dev` server and the real MongoDB database configured in `.env`. It registers two users, exercises project/task/subtask/note CRUD and RBAC (including cross-project access and the member-vs-admin subtask permission split), and cleans up everything it creates.

```bash
npm run dev                                       # in one terminal
RATE_LIMIT_ENABLED=false node scripts/verify.mjs  # in another, once the server is up
```

Disabling the rate limiter matters: the script makes several auth calls per run and would
otherwise exhaust the auth budget after a few consecutive runs.

## Security Notes

- **Project-scoped resource access.** Every task, subtask, and note lookup is constrained to the
  `:projectId` in the URL, not just the child's own id. A mismatch returns **404 rather than 403**,
  so the response cannot be used to probe whether a resource exists in another project.
  `scripts/verify.mjs` covers this directly.
- **Upload allowlist.** `src/middlewares/multer.middleware.js` accepts a file only when its MIME
  type is known *and* its extension belongs to that type, which also rejects double-extension
  tricks like `a.txt.html`. SVG is deliberately excluded because it can carry inline `<script>`.
  Stored filenames are random UUIDs, and everything under `public/` is served with
  `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.
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

- Add a committed `.env.example`.
- Expand automated coverage beyond the single smoke-test script (e.g. per-endpoint validation edge cases, token expiry/refresh behavior).
- Add linting in addition to the existing Prettier configuration.

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
