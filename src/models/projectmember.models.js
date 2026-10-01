import mongoose, { Schema } from "mongoose";
import { ALL_ROLES, ROLES } from "../utils/constants.js";

const projectMemberSchema = new Schema(
    {
        user: { type: Schema.Types.ObjectId, ref: "User", required: true },
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        role: { type: String, enum: ALL_ROLES, default: ROLES.MEMBER },
    },
    { timestamps: true },
);

// Decision: every protected request resolves the caller's role here, so the
// collection is indexed for each query shape. { project, user } serves lookups
// by both and, as a leftmost prefix, by project alone; being unique, it also
// makes a second role for the same person structurally impossible. { user }
// serves "my projects", which the compound index cannot.
projectMemberSchema.index({ project: 1, user: 1 }, { unique: true });
projectMemberSchema.index({ user: 1 });

export const ProjectMember = mongoose.model(
    "ProjectMember",
    projectMemberSchema,
);
