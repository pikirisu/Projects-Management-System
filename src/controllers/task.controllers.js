import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { saveAttachment, deleteAttachments } from "../utils/storage.js";

// A Subtask references only its parent Task, never a project, so authorization
// has to resolve through that parent. Both failure modes throw an identical 404
// so a caller cannot distinguish "no such subtask" from "not in your project".
const assertSubtaskInProject = async (subTaskId, projectId) => {
    const subtask = await Subtask.findById(subTaskId).select("task");
    if (!subtask) {
        throw new ApiError(404, "Subtask not found");
    }

    const parentTask = await Task.findOne({
        _id: subtask.task,
        project: projectId,
    }).select("_id");

    if (!parentTask) {
        throw new ApiError(404, "Subtask not found");
    }
};

/*
 * The validator can only see the request body, so all it can check is that
 * `assignedTo` looks like an ObjectId. Whether that user is on this project is
 * a fact about another collection -- and assigning work to a non-member gives
 * them a task they cannot open, because every task route is gated on
 * membership in the project the task belongs to.
 */
const assertAssigneeIsMember = async (assignedTo, projectId) => {
    const member = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(assignedTo),
    }).select("_id");

    if (!member) {
        throw new ApiError(
            400,
            "Assigned user is not a member of this project",
        );
    }
};

const getTasks = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }
    const tasks = await Task.find({
        project: new mongoose.Types.ObjectId(projectId),
    }).populate("assignedTo", "avatar username fullName");

    return res
        .status(200)
        .json(new ApiResponse(200, tasks, "Task fetched successfully"));
});
const createTask = asyncHandler(async (req, res) => {
    const { title, description, assignedTo, status } = req.body;
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }
    // Before the upload, not after: a rejected task that has already written
    // its blobs leaves them orphaned in storage with no row to delete them by.
    if (assignedTo) {
        await assertAssigneeIsMember(assignedTo, projectId);
    }

    const files = req.files || [];

    // Uploaded in parallel; storage.js decides Cloudinary vs. local disk and
    // returns the subdocument to persist, including the key needed to delete
    // the blob again later.
    const attachments = await Promise.all(
        files.map((file) => saveAttachment(file)),
    );

    const task = await Task.create({
        title,
        description,
        project: new mongoose.Types.ObjectId(projectId),
        assignedTo: assignedTo
            ? new mongoose.Types.ObjectId(assignedTo)
            : undefined,
        status,
        assignedBy: new mongoose.Types.ObjectId(req.user._id),
        attachments,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, task, "Task created successfully"));
});
const getTaskById = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.aggregate([
        {
            $match: {
                _id: new mongoose.Types.ObjectId(taskId),
                project: new mongoose.Types.ObjectId(projectId),
            },
        },
        {
            $lookup: {
                from: "users",
                localField: "assignedTo",
                foreignField: "_id",
                as: "assignedTo",
                pipeline: [
                    {
                        $project: {
                            _id: 1,
                            username: 1,
                            fullName: 1,
                            avatar: 1,
                        },
                    },
                ],
            },
        },
        {
            $lookup: {
                from: "subtasks",
                localField: "_id",
                foreignField: "task",
                as: "subtasks",
                pipeline: [
                    {
                        $lookup: {
                            from: "users",
                            localField: "createdBy",
                            foreignField: "_id",
                            as: "createdBy",
                            pipeline: [
                                {
                                    $project: {
                                        _id: 1,
                                        username: 1,
                                        fullName: 1,
                                        avatar: 1,
                                    },
                                },
                            ],
                        },
                    },
                    {
                        $addFields: {
                            createdBy: {
                                $arrayElemAt: ["$createdBy", 0],
                            },
                        },
                    },
                ],
            },
        },
        {
            $addFields: {
                assignedTo: {
                    $arrayElemAt: ["$assignedTo", 0],
                },
            },
        },
    ]);

    if (!task || task.length === 0) {
        throw new ApiError(404, "Task not found");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, task[0], "Task fetched successfully"));
});
const updateTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title, description, assignedTo, status } = req.body;

    if (assignedTo !== undefined) {
        await assertAssigneeIsMember(assignedTo, projectId);
    }

    const files = req.files || [];
    const newAttachments = await Promise.all(
        files.map((file) => saveAttachment(file)),
    );

    const updateOps = {
        $set: {
            ...(title !== undefined && { title }),
            ...(description !== undefined && { description }),
            ...(assignedTo !== undefined && {
                assignedTo: new mongoose.Types.ObjectId(assignedTo),
            }),
            ...(status !== undefined && { status }),
        },
    };
    if (newAttachments.length > 0) {
        updateOps.$push = { attachments: { $each: newAttachments } };
    }

    const task = await Task.findOneAndUpdate(
        { _id: taskId, project: projectId },
        updateOps,
        { new: true },
    );

    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, task, "Task updated successfully"));
});
const deleteTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;

    const task = await Task.findOneAndDelete({
        _id: taskId,
        project: projectId,
    });
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    await Subtask.deleteMany({ task: taskId });

    // Best effort, and deliberately after the row is gone: a blob we fail to
    // remove is wasted storage, but a blob store outage should not stop the
    // caller from deleting their own task.
    await deleteAttachments(task.attachments);

    return res
        .status(200)
        .json(new ApiResponse(200, task, "Task deleted successfully"));
});
const deleteTaskAttachment = asyncHandler(async (req, res) => {
    const { projectId, taskId, attachmentId } = req.params;

    /*
     * The read is only to recover the blob's provider and key, which the
     * subdocument stops carrying once it is pulled. The removal itself is a
     * single $pull scoped to both task and project -- splicing the array in
     * memory and saving the whole document would instead drop any attachment
     * another request appended in between.
     */
    const task = await Task.findOne({ _id: taskId, project: projectId });
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const attachment = task.attachments?.id(attachmentId);
    if (!attachment) {
        throw new ApiError(404, "Attachment not found");
    }

    // Snapshot before the pull: the subdocument is detached from the array
    // afterwards, and deleteAttachments still needs its provider and key.
    const removed = {
        provider: attachment.provider,
        key: attachment.key,
        resourceType: attachment.resourceType,
    };

    const updated = await Task.findOneAndUpdate(
        { _id: taskId, project: projectId },
        { $pull: { attachments: { _id: attachment._id } } },
        { new: true },
    );

    // Best effort and deliberately last, matching deleteTask: the row is the
    // source of truth, and a blob store outage should not fail the request.
    await deleteAttachments([removed]);

    return res
        .status(200)
        .json(new ApiResponse(200, updated, "Attachment removed successfully"));
});

const createSubTask = asyncHandler(async (req, res) => {
    const { projectId, taskId } = req.params;
    const { title } = req.body;

    const task = await Task.findOne({ _id: taskId, project: projectId });
    if (!task) {
        throw new ApiError(404, "Task not found");
    }

    const subtask = await Subtask.create({
        title,
        task: new mongoose.Types.ObjectId(taskId),
        createdBy: new mongoose.Types.ObjectId(req.user._id),
    });

    return res
        .status(201)
        .json(new ApiResponse(201, subtask, "Subtask created successfully"));
});
const updateSubTask = asyncHandler(async (req, res) => {
    const { projectId, subTaskId } = req.params;
    const { title, isCompleted } = req.body;

    await assertSubtaskInProject(subTaskId, projectId);

    const $set = {};

    if (isCompleted !== undefined) {
        $set.isCompleted = isCompleted;
    }

    if (title !== undefined) {
        if (
            req.user.role !== UserRolesEnum.ADMIN &&
            req.user.role !== UserRolesEnum.PROJECT_ADMIN
        ) {
            throw new ApiError(403, "Members not authorized to change titles.");
        }
        $set.title = title;
    }

    const subtask = await Subtask.findByIdAndUpdate(
        subTaskId,
        { $set },
        { new: true },
    );
    if (!subtask) throw new ApiError(404, "Subtask not found");
    return res
        .status(200)
        .json(new ApiResponse(200, subtask, "Subtask updated successfully"));
});
const deleteSubTask = asyncHandler(async (req, res) => {
    const { projectId, subTaskId } = req.params;

    await assertSubtaskInProject(subTaskId, projectId);

    const subtask = await Subtask.findByIdAndDelete(subTaskId);
    if (!subtask) {
        throw new ApiError(404, "Subtask not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, subtask, "Subtask deleted successfully"));
});

export {
    createSubTask,
    createTask,
    deleteTask,
    deleteSubTask,
    deleteTaskAttachment,
    getTaskById,
    getTasks,
    updateSubTask,
    updateTask,
};
