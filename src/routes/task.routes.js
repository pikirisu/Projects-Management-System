import { Router } from "express";
import {
    getTasks,
    createTask,
    getTaskById,
    updateTask,
    deleteTask,
    createSubTask,
    updateSubTask,
    deleteSubTask,
} from "../controllers/task.controllers.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    taskCreateValidator,
    taskUpdateValidator,
    subTaskCreateValidator,
    subTaskUpdateValidator,
} from "../validators/index.js";
import {
    verifyJWT,
    validateProjectPermission,
} from "../middlewares/auth.middleware.js";
import { upload } from "../middlewares/multer.middleware.js";
import { AvailableUserRole, UserRolesEnum } from "../utils/constants.js";

const router = Router();
router.use(verifyJWT);

const PROJECT_MANAGERS = [UserRolesEnum.ADMIN, UserRolesEnum.PROJECT_ADMIN];

router
    .route("/:projectId")
    .get(validateProjectPermission(AvailableUserRole), getTasks)
    .post(
        validateProjectPermission(PROJECT_MANAGERS),
        upload.array("attachments", 5),
        taskCreateValidator(),
        validate,
        createTask,
    );

router
    .route("/:projectId/t/:taskId")
    .get(validateProjectPermission(AvailableUserRole), getTaskById)
    .put(
        validateProjectPermission(PROJECT_MANAGERS),
        upload.array("attachments", 5),
        taskUpdateValidator(),
        validate,
        updateTask,
    )
    .delete(validateProjectPermission(PROJECT_MANAGERS), deleteTask);

router
    .route("/:projectId/t/:taskId/subtasks")
    .post(
        validateProjectPermission(PROJECT_MANAGERS),
        subTaskCreateValidator(),
        validate,
        createSubTask,
    );

router
    .route("/:projectId/st/:subTaskId")
    .put(
        validateProjectPermission(AvailableUserRole),
        subTaskUpdateValidator(),
        validate,
        updateSubTask,
    )
    .delete(validateProjectPermission(PROJECT_MANAGERS), deleteSubTask);

export default router;
