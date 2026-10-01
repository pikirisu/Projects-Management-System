import { Router } from "express";
import {
    createSubTask,
    createTask,
    deleteSubTask,
    deleteTask,
    deleteTaskAttachment,
    getTaskById,
    getTasks,
    updateSubTask,
    updateTask,
} from "../controllers/task.controllers.js";
import {
    anyMember,
    managersOnly,
    verifyJWT,
} from "../middlewares/auth.middleware.js";
import { uploadAttachments } from "../middlewares/multer.middleware.js";
import {
    createSubtaskRules,
    createTaskRules,
    updateSubtaskRules,
    updateTaskRules,
} from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

router
    .route("/:projectId")
    .get(anyMember, getTasks)
    .post(managersOnly, uploadAttachments, createTaskRules, createTask);

router
    .route("/:projectId/t/:taskId")
    .get(anyMember, getTaskById)
    .put(managersOnly, uploadAttachments, updateTaskRules, updateTask)
    .delete(managersOnly, deleteTask);

router.delete(
    "/:projectId/t/:taskId/attachments/:attachmentId",
    managersOnly,
    deleteTaskAttachment,
);

router.post(
    "/:projectId/t/:taskId/subtasks",
    managersOnly,
    createSubtaskRules,
    createSubTask,
);

// Any member may tick a subtask off; updateSubTask keeps renaming to managers.
router
    .route("/:projectId/st/:subTaskId")
    .put(anyMember, updateSubtaskRules, updateSubTask)
    .delete(managersOnly, deleteSubTask);

export default router;
