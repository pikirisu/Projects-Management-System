/** The envelope every API response uses (src/utils/api-response.js). */
export interface ApiEnvelope<T> {
    statusCode: number;
    data: T;
    message: string;
    success: boolean;
    /** On a 422: one `{ field: message }` per invalid field. */
    errors?: Array<Record<string, string>>;
}

/** Mirrors ROLES in src/utils/constants.js. */
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
    avatar?: { url: string };
    createdAt?: string;
}

export type TaskStatus = "todo" | "in_progress" | "done";

export const TASK_STATUSES: TaskStatus[] = ["todo", "in_progress", "done"];

export const TASK_STATUS_LABELS: Record<TaskStatus, string> = {
    todo: "To do",
    in_progress: "In progress",
    done: "Done",
};

export type TaskPriority = "low" | "medium" | "high";

/** Highest first, which is the order every picker and sort uses. */
export const TASK_PRIORITIES: TaskPriority[] = ["high", "medium", "low"];

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
};

export type TaskCounts = Partial<Record<TaskStatus, number>>;

export interface Project {
    _id: string;
    name: string;
    description?: string;
    createdBy?: string;
    createdAt?: string;
    /** Only on GET /projects, computed by its aggregation. */
    members?: number;
    taskCounts?: TaskCounts;
}

/** GET /projects: a project plus the caller's own role on it. */
export interface ProjectListEntry {
    project: Project;
    role: Role;
}

export interface AuthPayload {
    user: User;
    accessToken: string;
    refreshToken: string;
}

export interface Attachment {
    _id?: string;
    url: string;
    mimetype?: string;
    size?: number;
}

/**
 * Populated (a User) on reads, a bare id on create/update responses.
 * `asUser` and `refId` in ./display.ts read either shape.
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
    /** Absent on tasks created before priorities existed: read as medium. */
    priority?: TaskPriority;
    /** A calendar day, stored as UTC midnight. */
    dueDate?: string | null;
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

/** GET /me/tasks populates the project's name. */
export interface MyTask extends Omit<Task, "project"> {
    project: { _id: string; name: string };
}

export interface Note {
    _id: string;
    project: string;
    content: string;
    createdBy?: UserRef;
    createdAt?: string;
    updatedAt?: string;
}

/** GET /projects/:projectId/members. `user._id` is the row's key. */
export interface ProjectMemberEntry {
    project: string;
    user: User;
    role: Role;
    createdAt?: string;
    updatedAt?: string;
}
