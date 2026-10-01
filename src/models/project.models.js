import mongoose, { Schema } from "mongoose";

const projectSchema = new Schema(
    {
        // Not unique: names belong to their team, and a global index would
        // stop two teams both having a "Website" (and reveal that one exists).
        name: { type: String, required: true, trim: true },
        description: String,
        createdBy: { type: Schema.Types.ObjectId, ref: "User", required: true },
    },
    { timestamps: true },
);

export const Project = mongoose.model("Project", projectSchema);
