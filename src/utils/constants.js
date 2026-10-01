export const ROLES = {
    ADMIN: "admin",
    PROJECT_ADMIN: "project_admin",
    MEMBER: "member",
};

export const ALL_ROLES = Object.values(ROLES);

/** Roles that may create, edit, move and delete tasks. */
export const MANAGER_ROLES = [ROLES.ADMIN, ROLES.PROJECT_ADMIN];

export const TASK_STATUSES = ["todo", "in_progress", "done"];

export const TASK_PRIORITIES = ["low", "medium", "high"];
