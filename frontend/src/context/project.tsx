import { createContext, use } from "react";
import type { Permissions } from "../lib/permissions";
import type { ProjectMemberEntry } from "../lib/types";

export interface ProjectContextValue {
    projectId: string;
    /** What the signed-in user may do here; see lib/permissions.ts. */
    can: Permissions;
    members: ProjectMemberEntry[];
    /** Opens a task's slide-over, by putting its id in the URL. */
    openTask: (taskId: string) => void;
}

/** Provided by the project page to every panel and row inside it. */
export const ProjectContext = createContext<ProjectContextValue | null>(null);

export function useProjectContext() {
    const context = use(ProjectContext);
    if (!context) {
        throw new Error("useProjectContext must be used inside a project page");
    }
    return context;
}
