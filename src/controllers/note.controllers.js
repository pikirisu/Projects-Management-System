import { ProjectNote } from "../models/note.models.js";
import { ApiError } from "../utils/api-error.js";
import { respond } from "../utils/api-response.js";

// Like tasks, every note is looked up by its id AND the approved :projectId.

const AUTHOR_FIELDS = "username fullName avatar";

export async function getNotes(req, res) {
    const notes = await ProjectNote.find({ project: req.params.projectId })
        .populate("createdBy", AUTHOR_FIELDS)
        .sort({ createdAt: -1 });
    return respond(res, notes, "Notes fetched");
}

export async function createNote(req, res) {
    const note = await ProjectNote.create({
        project: req.params.projectId,
        content: req.body.content,
        createdBy: req.user._id,
    });
    return respond(res, note, "Note created", 201);
}

export async function getNoteById(req, res) {
    const { projectId, noteId } = req.params;
    const note = await ProjectNote.findOne({
        _id: noteId,
        project: projectId,
    }).populate("createdBy", AUTHOR_FIELDS);
    if (!note) throw new ApiError(404, "Note not found");
    return respond(res, note, "Note fetched");
}

export async function updateNote(req, res) {
    const { projectId, noteId } = req.params;
    const note = await ProjectNote.findOneAndUpdate(
        { _id: noteId, project: projectId },
        { content: req.body.content },
        { returnDocument: "after" },
    );
    if (!note) throw new ApiError(404, "Note not found");
    return respond(res, note, "Note updated");
}

export async function deleteNote(req, res) {
    const { projectId, noteId } = req.params;
    const note = await ProjectNote.findOneAndDelete({
        _id: noteId,
        project: projectId,
    });
    if (!note) throw new ApiError(404, "Note not found");
    return respond(res, note, "Note deleted");
}
