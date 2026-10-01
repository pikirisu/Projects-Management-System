import mongoose, { Schema } from "mongoose";
import { TASK_STATUSES } from "../utils/constants.js";
import { storedFileSchema } from "./stored-file.schema.js";

const taskSchema = new Schema(
    {
        title: { type: String, required: true, trim: true },
        description: String,
        project: {
            type: Schema.Types.ObjectId,
            ref: "Project",
            required: true,
        },
        assignedTo: { type: Schema.Types.ObjectId, ref: "User" },
        assignedBy: { type: Schema.Types.ObjectId, ref: "User" },
        status: { type: String, enum: TASK_STATUSES, default: "todo" },
        attachments: { type: [storedFileSchema], default: [] },
    },
    { timestamps: true },
);

// Every board load reads one project's tasks.
taskSchema.index({ project: 1, status: 1 });

export const Task = mongoose.model("Task", taskSchema);
