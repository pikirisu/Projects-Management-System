import { Router } from "express";
import {
    getNotes,
    createNote,
    getNoteById,
    updateNote,
    deleteNote,
} from "../controllers/note.controllers.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    noteCreateValidator,
    noteUpdateValidator,
} from "../validators/index.js";
import {
    verifyJWT,
    validateProjectPermission,
} from "../middlewares/auth.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();
router.use(verifyJWT);

router
    .route("/:projectId")
    .get(validateProjectPermission(AvailableUserRole), getNotes)
    .post(
        validateProjectPermission([UserRolesEnum.ADMIN]),
        noteCreateValidator(),
        validate,
        createNote,
    );

router
    .route("/:projectId/n/:noteId")
    .get(validateProjectPermission(AvailableUserRole), getNoteById)
    .put(
        validateProjectPermission([UserRolesEnum.ADMIN]),
        noteUpdateValidator(),
        validate,
        updateNote,
    )
    .delete(validateProjectPermission([UserRolesEnum.ADMIN]), deleteNote);

export default router;
