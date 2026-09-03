import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

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
    const files = req.files || [];

    const attachments = files.map((file) => {
        return {
            url: `${process.env.SERVER_URL}/images/${file.filename}`,
            mimetype: file.mimetype,
            size: file.size,
        };
    });

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

    const files = req.files || [];
    const newAttachments = files.map((file) => ({
        url: `${process.env.SERVER_URL}/images/${file.filename}`,
        mimetype: file.mimetype,
        size: file.size,
    }));

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

    return res
        .status(200)
        .json(new ApiResponse(200, task, "Task deleted successfully"));
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
    getTaskById,
    getTasks,
    updateSubTask,
    updateTask,
};
