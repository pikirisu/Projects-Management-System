import type { Role } from "./types";

export interface Permissions {
    /** Create, edit, move and delete tasks and subtasks. */
    manageTasks: boolean;
    /** Rename or delete the project, manage members, write notes. */
    manageProject: boolean;
}

// Decision: the UI mirrors the server's role rules only to decide what to
// offer. The server enforces every rule itself, so a stale role here costs a
// 403, never access.
export function permissionsFor(role: Role | null): Permissions {
    return {
        manageTasks: role === "admin" || role === "project_admin",
        manageProject: role === "admin",
    };
}
