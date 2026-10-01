import { Router } from "express";
import {
    createNote,
    deleteNote,
    getNoteById,
    getNotes,
    updateNote,
} from "../controllers/note.controllers.js";
import {
    adminsOnly,
    anyMember,
    verifyJWT,
} from "../middlewares/auth.middleware.js";
import { noteRules } from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

// Everyone on the project reads notes; only admins write them.
router
    .route("/:projectId")
    .get(anyMember, getNotes)
    .post(adminsOnly, noteRules, createNote);

router
    .route("/:projectId/n/:noteId")
    .get(anyMember, getNoteById)
    .put(adminsOnly, noteRules, updateNote)
    .delete(adminsOnly, deleteNote);

export default router;
