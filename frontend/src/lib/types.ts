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
