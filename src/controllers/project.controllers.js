import mongoose from "mongoose";
import { ProjectNote } from "../models/note.models.js";
import { Project } from "../models/project.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { Subtask } from "../models/subtask.models.js";
import { Task } from "../models/task.models.js";
import { User } from "../models/user.models.js";
import { lookupUser } from "../utils/aggregations.js";
import { ApiError } from "../utils/api-error.js";
import { respond } from "../utils/api-response.js";
import { ROLES } from "../utils/constants.js";
import { deleteStoredFiles } from "../utils/storage.js";

// ---- projects ----------------------------------------------------------------

/**
 * Every project the caller belongs to, with their role on it and its member
 * count. One round trip: the count is a $lookup sub-pipeline rather than
 * loading every membership row.
 */
export async function getProjects(req, res) {
    const projects = await ProjectMember.aggregate([
        { $match: { user: req.user._id } },
        {
            $lookup: {
                from: "projects",
                localField: "project",
                foreignField: "_id",
                as: "project",
            },
        },
        { $unwind: "$project" },
        {
            $lookup: {
                from: "projectmembers",
                localField: "project._id",
                foreignField: "project",
                as: "memberCount",
                pipeline: [{ $count: "n" }],
            },
        },
        {
            $project: {
                _id: 0,
                role: 1,
                project: {
                    _id: "$project._id",
                    name: "$project.name",
                    description: "$project.description",
                    createdBy: "$project.createdBy",
                    createdAt: "$project.createdAt",
                    members: { $ifNull: [{ $first: "$memberCount.n" }, 0] },
                },
            },
        },
        { $sort: { "project.createdAt": -1 } },
    ]);

    return respond(res, projects, "Projects fetched");
}

export async function getProjectById(req, res) {
    const project = await Project.findById(req.params.projectId);
    if (!project) throw new ApiError(404, "Project not found");
    return respond(res, project, "Project fetched");
}

export async function createProject(req, res) {
    const { name, description } = req.body;
    const project = await Project.create({
        name,
        description,
        createdBy: req.user._id,
    });
    await ProjectMember.create({
        user: req.user._id,
        project: project._id,
        role: ROLES.ADMIN,
    });
    return respond(res, project, "Project created", 201);
}

export async function updateProject(req, res) {
    const { name, description } = req.body;
    const project = await Project.findByIdAndUpdate(
        req.params.projectId,
        { name, description },
        { returnDocument: "after" },
    );
    if (!project) throw new ApiError(404, "Project not found");
    return respond(res, project, "Project updated");
}

// Decision: MongoDB has no foreign keys, so the cascade is explicit. Stored
// files go last and best-effort: the rows are the source of truth, and a
// storage outage must not stop someone deleting their own project.
export async function deleteProject(req, res) {
    const { projectId } = req.params;
    const project = await Project.findByIdAndDelete(projectId);
    if (!project) throw new ApiError(404, "Project not found");

    // Subtasks reference their task, not the project, so resolve those first.
    const tasks = await Task.find({ project: projectId }).select("attachments");
    await Promise.all([
        ProjectMember.deleteMany({ project: projectId }),
        ProjectNote.deleteMany({ project: projectId }),
        Subtask.deleteMany({ task: { $in: tasks.map((task) => task._id) } }),
        Task.deleteMany({ project: projectId }),
    ]);
    await deleteStoredFiles(tasks.flatMap((task) => task.attachments));

    return respond(res, project, "Project deleted");
}

// ---- members -----------------------------------------------------------------

export async function getProjectMembers(req, res) {
    const members = await ProjectMember.aggregate([
        {
            $match: {
                project: new mongoose.Types.ObjectId(req.params.projectId),
            },
        },
        ...lookupUser("user"),
        {
            $project: {
                _id: 0,
                project: 1,
                user: 1,
                role: 1,
                createdAt: 1,
                updatedAt: 1,
            },
        },
        { $sort: { createdAt: 1 } },
    ]);
    return respond(res, members, "Members fetched");
}

export async function addMemberToProject(req, res) {
    const { email, role } = req.body;
    const user = await User.findOne({ email });
    if (!user) {
        throw new ApiError(404, "No account exists with that email address");
    }

    // Decision: adding only ever inserts. The unique { project, user } index
    // refuses an existing member atomically, so this route can never rewrite
    // (and so never demote) a role; only updateMemberRole changes one.
    try {
        await ProjectMember.create({
            user: user._id,
            project: req.params.projectId,
            role,
        });
    } catch (error) {
        if (error.code === 11000) {
            throw new ApiError(
                409,
                "That person is already a member of this project. Change their role instead.",
            );
        }
        throw error;
    }

    return respond(res, {}, "Member added", 201);
}

// Decision: a project with no admin can never be repaired, because every
// management route requires one. Role changes and removals write first, then
// re-count admins and undo their own write if the count reached zero. Without
// a transaction (which needs a replica set), this is what stops two admins who
// demote each other at the same moment from both succeeding.
async function keepAnAdmin(projectId, undo) {
    const admins = await ProjectMember.countDocuments({
        project: projectId,
        role: ROLES.ADMIN,
    });
    if (admins === 0) {
        await undo();
        throw new ApiError(
            409,
            "A project must keep at least one admin. Promote another member first.",
        );
    }
}

export async function updateMemberRole(req, res) {
    const { projectId, userId } = req.params;
    const { newRole } = req.body;

    // Returns the row as it was before the update.
    const member = await ProjectMember.findOneAndUpdate(
        { project: projectId, user: userId },
        { role: newRole },
    );
    if (!member) throw new ApiError(404, "Project member not found");

    if (member.role === ROLES.ADMIN && newRole !== ROLES.ADMIN) {
        await keepAnAdmin(projectId, () =>
            ProjectMember.updateOne({ _id: member._id }, { role: ROLES.ADMIN }),
        );
    }

    member.role = newRole;
    return respond(res, member, "Member role updated");
}

export async function deleteMember(req, res) {
    const { projectId, userId } = req.params;

    const member = await ProjectMember.findOneAndDelete({
        project: projectId,
        user: userId,
    });
    if (!member) throw new ApiError(404, "Project member not found");

    if (member.role === ROLES.ADMIN) {
        await keepAnAdmin(projectId, () =>
            ProjectMember.create(member.toObject()),
        );
    }

    // Decision: someone who leaves a project leaves its tasks too, so every
    // assignee remains someone who can open the task assigned to them.
    await Task.updateMany(
        { project: projectId, assignedTo: userId },
        { $unset: { assignedTo: 1 } },
    );

    return respond(res, member, "Member removed");
}
