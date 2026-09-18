import mongoose, { Schema } from "mongoose";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const projectMemberSchema = new Schema(
    {
        user: {
            type: Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        role: {
            type: String,
            enum: AvailableUserRole,
            default: UserRolesEnum.MEMBER,
        },
    },
    { timestamps: true },
);

// This collection is the lookup key for every authorized request in the API:
// validateProjectPermission (src/middlewares/auth.middleware.js) resolves a
// caller's role here before any protected controller runs, so without an index
// that resolution is a full collection scan on all 26 protected routes.
//
// Three query shapes exist, and two indexes cover them:
//
//   { project, user } - validateProjectPermission, updateMemberRole,
//                       deleteMember, addMembersToProject
//   { project }       - getProjectMembers aggregation
//   { user }          - getProjects aggregation
//
// A compound index serves any *leftmost prefix* of its keys, so
// { project: 1, user: 1 } answers the first two shapes. It cannot answer the
// third: `user` is not a prefix, so a { user } query would still scan. That
// shape needs its own index.
projectMemberSchema.index({ project: 1, user: 1 }, { unique: true });
projectMemberSchema.index({ user: 1 });

// `unique` above does more than speed things up: it makes a duplicate
// membership row structurally impossible, which matters because a second row
// for the same pair would give one user two roles on one project and leave
// which one wins up to document order. Mongo rejects the write with E11000,
// and the central error handler (src/app.js) already maps that to a 409.

export const ProjectMember = mongoose.model(
    "ProjectMember",
    projectMemberSchema,
);
