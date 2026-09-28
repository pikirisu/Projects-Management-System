/**
 * Every controller in the API answers with the same envelope
 * (src/utils/api-response.js), so one generic type covers the whole surface.
 */
export interface ApiEnvelope<T> {
    statusCode: number;
    data: T;
    message: string;
    success: boolean;
    /**
     * Present on failures. The validator middleware emits one single-key object
     * per invalid field -- `[{ email: "Email is invalid" }]` -- which `ApiError`
     * in ./api.ts flattens into a field -> message record.
     */
    errors?: Array<Record<string, string>>;
}

/** Mirrors UserRolesEnum in src/utils/constants.js. */
export type Role = "admin" | "project_admin" | "member";

export const ROLE_LABELS: Record<Role, string> = {
    admin: "Admin",
    project_admin: "Project admin",
    member: "Member",
};

export interface User {
    _id: string;
    username: string;
    email: string;
    fullName?: string;
    isEmailVerified?: boolean;
    avatar?: {
        url: string;
        localPath?: string;
    };
    createdAt?: string;
}

export interface Project {
    _id: string;
    name: string;
    description?: string;
    /** Live count, computed by the getProjects aggregation. Absent elsewhere. */
    members?: number;
    createdBy?: string;
    createdAt?: string;
}

/** The shape GET /projects returns: a project plus *the caller's* role on it. */
export interface ProjectListEntry {
    project: Project;
    role: Role;
}

export interface AuthPayload {
    user: User;
    accessToken: string;
    refreshToken: string;
}

/** Mirrors TaskStatusEnum in src/utils/constants.js. */
export type TaskStatus = "todo" | "in_progress" | "done";

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    todo: "To do",
    in_progress: "In progress",
    done: "Done",
};

export interface Attachment {
    _id?: string;
    url: string;
    mimetype?: string;
    size?: number;
    provider?: string;
    key?: string;
    resourceType?: string;
}

/**
 * `assignedTo` is populated on reads (GET /tasks/:projectId and the
 * getTaskById aggregation) but comes back as a bare id from create/update,
 * which return the raw document. `asUser` in ./display.ts narrows the two.
 */
export type UserRef = User | string | null | undefined;

export interface Task {
    _id: string;
    title: string;
    description?: string;
    project: string;
    assignedTo?: UserRef;
    assignedBy?: UserRef;
    status: TaskStatus;
    attachments?: Attachment[];
    createdAt?: string;
    updatedAt?: string;
}

export interface Subtask {
    _id: string;
    title: string;
    task: string;
    isCompleted: boolean;
    createdBy?: UserRef;
    createdAt?: string;
}

/** GET /tasks/:projectId/t/:taskId joins the subtasks in. */
export interface TaskDetail extends Task {
    subtasks: Subtask[];
}

export interface Note {
    _id: string;
    project: string;
    content: string;
    createdBy?: UserRef;
    createdAt?: string;
    updatedAt?: string;
}

/**
 * GET /projects/:projectId/members. The aggregation projects `_id: 0`, so the
 * membership row has no id of its own -- `user._id` is the key, and it is also
 * what the update/delete routes take as their :userId segment.
 */
export interface ProjectMemberEntry {
    project: string;
    user: User;
    role: Role;
    createdAt?: string;
    updatedAt?: string;
}
