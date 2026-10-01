import { Router } from "express";
import {
    addMemberToProject,
    createProject,
    deleteMember,
    deleteProject,
    getProjectById,
    getProjectMembers,
    getProjects,
    updateMemberRole,
    updateProject,
} from "../controllers/project.controllers.js";
import {
    adminsOnly,
    anyMember,
    verifyJWT,
} from "../middlewares/auth.middleware.js";
import {
    addMemberRules,
    memberRoleRules,
    projectRules,
} from "../validators/index.js";

const router = Router();
router.use(verifyJWT);

router.route("/").get(getProjects).post(projectRules, createProject);

router
    .route("/:projectId")
    .get(anyMember, getProjectById)
    .put(adminsOnly, projectRules, updateProject)
    .delete(adminsOnly, deleteProject);

router
    .route("/:projectId/members")
    .get(anyMember, getProjectMembers)
    .post(adminsOnly, addMemberRules, addMemberToProject);

router
    .route("/:projectId/members/:userId")
    .put(adminsOnly, memberRoleRules, updateMemberRole)
    .delete(adminsOnly, deleteMember);

export default router;
