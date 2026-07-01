import { Router } from "express";
import { registerUser } from "../controllers/auth.controller.js";

const authRouter = Router();

authRouter.route("/register-user").post(registerUser);

export default authRouter;
