import { Router } from "express";
import { getMyTasks } from "../controllers/task.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";

// Resources that belong to the signed-in user across every project.
const router = Router();
router.use(verifyJWT);

router.get("/tasks", getMyTasks);

export default router;
