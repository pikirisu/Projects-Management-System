import mongoose from "mongoose";
import { ProjectMember } from "../models/projectmember.models.js";
import { Subtask } from "../models/subtask.models.js";
import { Task } from "../models/task.models.js";
import { lookupUser } from "../utils/aggregations.js";
import { ApiError } from "../utils/api-error.js";
import { respond } from "../utils/api-response.js";
import { MANAGER_ROLES } from "../utils/constants.js";
import { deleteStoredFiles, saveUpload } from "../utils/storage.js";

// Decision: every child resource is fetched by its own id AND the :projectId
// the role guard approved. A task from another project answers 404, exactly
// like one that does not exist, so ids cannot be probed across projects.

const TASK_FIELDS = ["title", "description", "status", "assignedTo"];

/**
 * Splits a request body into $set and $unset. An empty value (null, or "" from
 * a multipart form) clears the field: that is how a task is unassigned.
 */
function taskChanges(body) {
    const $set = {};
    const $unset = {};
    for (const field of TASK_FIELDS) {
        const value = body[field];
        if (value === undefined) continue;
        if (value === null || value === "") $unset[field] = 1;
        else $set[field] = value;
    }
    return { $set, $unset };
}

// Decision: an assignee must be a member of the project, or they would own a
// task they cannot open. Checked before any upload, so a refused request never
// leaves files in storage with no row pointing at them.
async function assertAssigneeIsMember(assignedTo, projectId) {
    if (!assignedTo) return;
    const isMember = await ProjectMember.exists({
        project: projectId,
        user: assignedTo,
    });
    if (!isMember) {
        throw new ApiError(
            400,
            "Assigned user is not a member of this project",
        );
    }
}

const uploadAll = (files = []) =>
    Promise.all(files.map((file) => saveUpload(file)));

// ---- tasks -------------------------------------------------------------------

export async function getTasks(req, res) {
    const tasks = await Task.find({ project: req.params.projectId })
        .populate("assignedTo", "username fullName avatar")
        .sort({ createdAt: -1 });
    return respond(res, tasks, "Tasks fetched");
}

export async function createTask(req, res) {
    const { projectId } = req.params;
    const { $set } = taskChanges(req.body);
    await assertAssigneeIsMember($set.assignedTo, projectId);

    const task = await Task.create({
        ...$set,
        project: projectId,
        assignedBy: req.user._id,
        attachments: await uploadAll(req.files),
    });
    return respond(res, task, "Task created", 201);
}

export async function getTaskById(req, res) {
    const [task] = await Task.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(req.params.taskId),
                project: new mongoose.Types.ObjectId(req.params.projectId),
            },
        },
        ...lookupUser("assignedTo"),
        {
            $lookup: {
                from: "subtasks",
                localField: "_id",
                foreignField: "task",
                as: "subtasks",
                pipeline: [
                    ...lookupUser("createdBy"),
                    { $sort: { createdAt: 1 } },
                ],
            },
        },
    ]);
    if (!task) throw new ApiError(404, "Task not found");
    return respond(res, task, "Task fetched");
}

export async function updateTask(req, res) {
    const { projectId, taskId } = req.params;
    const { $set, $unset } = taskChanges(req.body);
    await assertAssigneeIsMember($set.assignedTo, projectId);

    // New files are appended; removing one is deleteTaskAttachment's job.
    const attachments = await uploadAll(req.files);
    const update = { $set, $unset };
    if (attachments.length > 0) {
        update.$push = { attachments: { $each: attachments } };
    }

    const task = await Task.findOneAndUpdate(
        { _id: taskId, project: projectId },
        update,
        { returnDocument: "after" },
    );
    if (!task) {
        await deleteStoredFiles(attachments);
        throw new ApiError(404, "Task not found");
    }
    return respond(res, task, "Task updated");
}

export async function deleteTask(req, res) {
    const { projectId, taskId } = req.params;
    const task = await Task.findOneAndDelete({
        _id: taskId,
        project: projectId,
    });
    if (!task) throw new ApiError(404, "Task not found");

    await Subtask.deleteMany({ task: taskId });
    await deleteStoredFiles(task.attachments);
    return respond(res, task, "Task deleted");
}

export async function deleteTaskAttachment(req, res) {
    const { projectId, taskId, attachmentId } = req.params;

    // One atomic $pull scoped to the project. The document it returns is from
    // before the pull, so it still holds the attachment whose file to delete.
    const task = await Task.findOneAndUpdate(
        { _id: taskId, project: projectId, "attachments._id": attachmentId },
        { $pull: { attachments: { _id: attachmentId } } },
    );
    if (!task) throw new ApiError(404, "Attachment not found");

    const removed = task.attachments.id(attachmentId).toObject();
    task.attachments.pull(attachmentId); // mirror the write in the response
    await deleteStoredFiles([removed]);

    return respond(res, task, "Attachment removed");
}

// ---- subtasks ----------------------------------------------------------------

/** A subtask belongs to a task, not a project, so scope through its parent. */
async function assertSubtaskInProject(subTaskId, projectId) {
    const subtask = await Subtask.findById(subTaskId).select("task");
    const inProject =
        subtask &&
        (await Task.exists({ _id: subtask.task, project: projectId }));
    if (!inProject) throw new ApiError(404, "Subtask not found");
}

export async function createSubTask(req, res) {
    const { projectId, taskId } = req.params;
    if (!(await Task.exists({ _id: taskId, project: projectId }))) {
        throw new ApiError(404, "Task not found");
    }

    const subtask = await Subtask.create({
        title: req.body.title,
        task: taskId,
        createdBy: req.user._id,
    });
    return respond(res, subtask, "Subtask created", 201);
}

export async function updateSubTask(req, res) {
    const { projectId, subTaskId } = req.params;
    const { title, isCompleted } = req.body;
    await assertSubtaskInProject(subTaskId, projectId);

    // Any member may tick a subtask off; only a manager may rename it.
    if (title !== undefined && !MANAGER_ROLES.includes(req.projectRole)) {
        throw new ApiError(403, "Only a project admin can rename a subtask");
    }

    const subtask = await Subtask.findByIdAndUpdate(
        subTaskId,
        {
            $set: {
                ...(title !== undefined && { title }),
                ...(isCompleted !== undefined && { isCompleted }),
            },
        },
        { returnDocument: "after" },
    );
    return respond(res, subtask, "Subtask updated");
}

export async function deleteSubTask(req, res) {
    const { projectId, subTaskId } = req.params;
    await assertSubtaskInProject(subTaskId, projectId);
    const subtask = await Subtask.findByIdAndDelete(subTaskId);
    return respond(res, subtask, "Subtask deleted");
}
