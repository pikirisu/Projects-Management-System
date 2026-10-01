import {
    useMutation,
    useQuery,
    useQueryClient,
    type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { api, errorMessage } from "./api";
import type {
    MyTask,
    Note,
    Project,
    ProjectListEntry,
    ProjectMemberEntry,
    Task,
    TaskDetail,
    TaskStatus,
} from "./types";

/** Every query key in one place, so invalidation cannot drift from reads. */
export const keys = {
    projects: ["projects"] as const,
    myTasks: ["my-tasks"] as const,
    project: (projectId: string) => ["project", projectId] as const,
    members: (projectId: string) => ["project", projectId, "members"] as const,
    tasks: (projectId: string) => ["project", projectId, "tasks"] as const,
    task: (projectId: string, taskId: string) =>
        ["project", projectId, "task", taskId] as const,
    notes: (projectId: string) => ["project", projectId, "notes"] as const,
};

export const useProjects = () =>
    useQuery({
        queryKey: keys.projects,
        queryFn: () => api.get<ProjectListEntry[]>("/projects"),
    });

export const useMyTasks = () =>
    useQuery({
        queryKey: keys.myTasks,
        queryFn: () => api.get<MyTask[]>("/me/tasks"),
    });

export const useProject = (projectId: string) =>
    useQuery({
        queryKey: keys.project(projectId),
        queryFn: () => api.get<Project>(`/projects/${projectId}`),
    });

export const useMembers = (projectId: string) =>
    useQuery({
        queryKey: keys.members(projectId),
        queryFn: () =>
            api.get<ProjectMemberEntry[]>(`/projects/${projectId}/members`),
    });

export const useTasks = (projectId: string) =>
    useQuery({
        queryKey: keys.tasks(projectId),
        queryFn: () => api.get<Task[]>(`/tasks/${projectId}`),
    });

export const useTask = (projectId: string, taskId: string) =>
    useQuery({
        queryKey: keys.task(projectId, taskId),
        queryFn: () => api.get<TaskDetail>(`/tasks/${projectId}/t/${taskId}`),
    });

export const useNotes = (projectId: string) =>
    useQuery({
        queryKey: keys.notes(projectId),
        queryFn: () => api.get<Note[]>(`/notes/${projectId}`),
    });

/**
 * Refetches everything that shows a project's tasks: the board, any open task,
 * the progress counts on the project list, and My tasks.
 */
export function invalidateTasks(queryClient: QueryClient, projectId: string) {
    for (const queryKey of [
        keys.tasks(projectId),
        ["project", projectId, "task"],
        keys.projects,
        keys.myTasks,
    ]) {
        void queryClient.invalidateQueries({ queryKey });
    }
}

/** Refetches the member list and the member counts on the project list. */
export function invalidateMembers(queryClient: QueryClient, projectId: string) {
    void queryClient.invalidateQueries({ queryKey: keys.members(projectId) });
    void queryClient.invalidateQueries({ queryKey: keys.projects });
}

// Decision: moving a card is optimistic, unlike other edits. It is frequent
// enough that waiting for the server reads as the board ignoring the gesture,
// and a dragged card would spring back. A refusal restores the exact previous
// list, not a refetch, and says why in a toast.
export function useMoveTask(projectId: string) {
    const queryClient = useQueryClient();
    const tasksKey = keys.tasks(projectId);

    return useMutation({
        mutationFn: ({
            taskId,
            status,
        }: {
            taskId: string;
            status: TaskStatus;
        }) => api.put<Task>(`/tasks/${projectId}/t/${taskId}`, { status }),
        onMutate: async ({ taskId, status }) => {
            await queryClient.cancelQueries({ queryKey: tasksKey });
            const previous = queryClient.getQueryData<Task[]>(tasksKey);
            queryClient.setQueryData<Task[]>(tasksKey, (current) =>
                current?.map((task) =>
                    task._id === taskId ? { ...task, status } : task,
                ),
            );
            return { previous };
        },
        onError: (error, _variables, context) => {
            if (context?.previous) {
                queryClient.setQueryData(tasksKey, context.previous);
            }
            toast.error(errorMessage(error, "Could not move the task"));
        },
        onSettled: () => invalidateTasks(queryClient, projectId),
    });
}
