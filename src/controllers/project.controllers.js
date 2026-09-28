import { User } from "../models/user.models.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { Task } from "../models/task.models.js";
import { Subtask } from "../models/subtask.models.js";
import { ProjectNote } from "../models/note.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import mongoose from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";
import { deleteAttachments } from "../utils/storage.js";

const getProjects = asyncHandler(async (req, res) => {
    const projects = await ProjectMember.aggregate([
        {
            $match: {
                user: new mongoose.Types.ObjectId(req.user._id),
            },
        },
        {
            $lookup: {
                from: "projects",
                localField: "project",
                foreignField: "_id",
                as: "project",
                pipeline: [
                    {
                        $lookup: {
                            from: "projectmembers",
                            localField: "_id",
                            foreignField: "project",
                            as: "projectmembers",
                        },
                    },
                    {
                        $addFields: {
                            members: {
                                $size: "$projectmembers",
                            },
                        },
                    },
                ],
            },
        },
        {
            $unwind: "$project",
        },
        {
            $project: {
                project: {
                    _id: 1,
                    name: 1,
                    description: 1,
                    members: 1,
                    createdAt: 1,
                    createdBy: 1,
                },
                role: 1,
                _id: 0,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, projects, "Projects fetched successfully"));
});

const getProjectById = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project fetched successfully"));
});

const createProject = asyncHandler(async (req, res) => {
    const { name, description } = req.body;

    const project = await Project.create({
        name,
        description,
        createdBy: new mongoose.Types.ObjectId(req.user._id),
    });

    await ProjectMember.create({
        user: new mongoose.Types.ObjectId(req.user._id),
        project: new mongoose.Types.ObjectId(project._id),
        role: UserRolesEnum.ADMIN,
    });

    return res
        .status(201)
        .json(new ApiResponse(201, project, "Project created Successfully"));
});

const updateProject = asyncHandler(async (req, res) => {
    const { name, description } = req.body;
    const { projectId } = req.params;

    const project = await Project.findByIdAndUpdate(
        projectId,
        {
            name,
            description,
        },
        { new: true },
    );

    if (!project) {
        throw new ApiError(404, "Project not found");
    }
    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project updated successfully"));
});

const deleteProject = asyncHandler(async (req, res) => {
    const { projectId } = req.params;

    const project = await Project.findByIdAndDelete(projectId);
    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    // Everything below hangs off the project by reference, and MongoDB has no
    // foreign keys to cascade for us. Deleting only the Project row left
    // members, tasks, subtasks and notes stranded in their collections --
    // invisible to the API but still occupying the database, and in the case of
    // attachments, still billable storage.
    //
    // Subtasks reference their parent Task rather than the project, so their
    // ids have to be resolved before the tasks are removed.
    const tasks = await Task.find({ project: projectId }).select(
        "_id attachments",
    );
    const taskIds = tasks.map((task) => task._id);

    await Promise.all([
        ProjectMember.deleteMany({ project: projectId }),
        ProjectNote.deleteMany({ project: projectId }),
        Subtask.deleteMany({ task: { $in: taskIds } }),
        Task.deleteMany({ project: projectId }),
    ]);

    await deleteAttachments(tasks.flatMap((task) => task.attachments ?? []));

    return res
        .status(200)
        .json(new ApiResponse(200, project, "Project deleted successfully"));
});

const addMembersToProject = asyncHandler(async (req, res) => {
    const { email, role } = req.body;
    const { projectId } = req.params;
    const user = await User.findOne({ email });

    if (!user) {
        throw new ApiError(404, "No account exists with that email address");
    }

    await ProjectMember.findOneAndUpdate(
        {
            user: user._id,
            project: projectId,
        },
        {
            $set: {
                role,
            },
            $setOnInsert: {
                user: user._id,
                project: projectId,
            },
        },
        {
            new: true,
            upsert: true,
        },
    );

    return res
        .status(201)
        .json(new ApiResponse(201, {}, "Project member added successfully"));
});

const getProjectMembers = asyncHandler(async (req, res) => {
    const { projectId } = req.params;
    const project = await Project.findById(projectId);

    if (!project) {
        throw new ApiError(404, "Project not found");
    }

    const projectMembers = await ProjectMember.aggregate([
        {
            $match: {
                project: new mongoose.Types.ObjectId(projectId),
            },
        },

        {
            $lookup: {
                from: "users",
                localField: "user",
                foreignField: "_id",
                as: "user",
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
                user: {
                    $arrayElemAt: ["$user", 0],
                },
            },
        },
        {
            $project: {
                project: 1,
                user: 1,
                role: 1,
                createdAt: 1,
                updatedAt: 1,
                _id: 0,
            },
        },
    ]);

    return res
        .status(200)
        .json(new ApiResponse(200, projectMembers, "Project members fetched"));
});

/*
 * A project with no admin is unrecoverable. Renaming it, deleting it, adding a
 * member and changing a role are all gated on the admin role, so once the last
 * admin is gone nobody left can repair it -- the rows simply sit in the
 * database, still paying for their attachment blobs. Both the demote path and
 * the remove path have to hold this line, and an admin acting on someone else
 * is as capable of crossing it as one acting on themselves.
 */
const countAdmins = (projectId) =>
    ProjectMember.countDocuments({
        project: new mongoose.Types.ObjectId(projectId),
        role: UserRolesEnum.ADMIN,
    });

const LAST_ADMIN_MESSAGE =
    "A project must keep at least one admin. Promote another member first.";

const updateMemberRole = asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;
    const { newRole } = req.body;

    if (!AvailableUserRole.includes(newRole)) {
        throw new ApiError(400, "Invalid Role");
    }

    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
    });

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    const demotingAnAdmin =
        projectMember.role === UserRolesEnum.ADMIN &&
        newRole !== UserRolesEnum.ADMIN;

    if (demotingAnAdmin && (await countAdmins(projectId)) <= 1) {
        throw new ApiError(409, LAST_ADMIN_MESSAGE);
    }

    projectMember = await ProjectMember.findByIdAndUpdate(
        projectMember._id,
        {
            role: newRole,
        },
        { new: true },
    );

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    /*
     * The count above and the write below are two round trips, so two admins
     * demoting each other at the same moment can both pass the check. Re-count
     * afterwards and undo if the invariant actually broke: in that race both
     * writers restore their own row and both report a conflict, which leaves
     * the project exactly as it started. A transaction would be tidier, but it
     * would require a replica set, and CI runs a standalone mongod.
     */
    if (demotingAnAdmin && (await countAdmins(projectId)) === 0) {
        await ProjectMember.findByIdAndUpdate(projectMember._id, {
            role: UserRolesEnum.ADMIN,
        });
        throw new ApiError(409, LAST_ADMIN_MESSAGE);
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                projectMember,
                "Project member role updated successfully",
            ),
        );
});

const deleteMember = asyncHandler(async (req, res) => {
    const { projectId, userId } = req.params;

    let projectMember = await ProjectMember.findOne({
        project: new mongoose.Types.ObjectId(projectId),
        user: new mongoose.Types.ObjectId(userId),
    });

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    const removingAnAdmin = projectMember.role === UserRolesEnum.ADMIN;

    if (removingAnAdmin && (await countAdmins(projectId)) <= 1) {
        throw new ApiError(409, LAST_ADMIN_MESSAGE);
    }

    projectMember = await ProjectMember.findByIdAndDelete(projectMember._id);

    if (!projectMember) {
        throw new ApiError(400, "Project member not found");
    }

    // Same race as updateMemberRole, same compensating write: put the
    // membership back rather than leave the project with nobody in charge.
    if (removingAnAdmin && (await countAdmins(projectId)) === 0) {
        await ProjectMember.create({
            user: projectMember.user,
            project: projectMember.project,
            role: projectMember.role,
        });
        throw new ApiError(409, LAST_ADMIN_MESSAGE);
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                projectMember,
                "Project member deleted successfully",
            ),
        );
});

export {
    addMembersToProject,
    createProject,
    deleteMember,
    getProjects,
    getProjectById,
    getProjectMembers,
    updateProject,
    deleteProject,
    updateMemberRole,
};
