import mongoose, { Schema } from "mongoose";
import { TASK_PRIORITIES, TASK_STATUSES } from "../utils/constants.js";
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
        priority: { type: String, enum: TASK_PRIORITIES, default: "medium" },
        // A calendar day, stored as UTC midnight.
        dueDate: Date,
        attachments: { type: [storedFileSchema], default: [] },
    },
    { timestamps: true },
);

// The board reads one project's tasks and the project list counts them by
// status; "My tasks" reads by assignee.
taskSchema.index({ project: 1, status: 1 });
taskSchema.index({ assignedTo: 1 });

export const Task = mongoose.model("Task", taskSchema);
