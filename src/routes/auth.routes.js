import { Router } from "express";
import {
    changeCurrentPassword,
    forgotPasswordRequest,
    getCurrentUser,
    login,
    logoutUser,
    refreshAccessToken,
    registerUser,
    resendEmailVerification,
    resetForgotPassword,
    updateAvatar,
    updateProfile,
    verifyEmail,
} from "../controllers/auth.controllers.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { uploadAvatar } from "../middlewares/multer.middleware.js";
import { authLimiter } from "../middlewares/rate-limit.middleware.js";
import {
    changePasswordRules,
    forgotPasswordRules,
    loginRules,
    profileRules,
    registerRules,
    resetPasswordRules,
} from "../validators/index.js";

const router = Router();

// Public. authLimiter guards everything that guesses credentials or tokens.
router.post("/register", authLimiter, registerRules, registerUser);
router.post("/login", authLimiter, loginRules, login);
router.post("/refresh-token", authLimiter, refreshAccessToken);
router.get("/verify-email/:verificationToken", authLimiter, verifyEmail);
router.post(
    "/forgot-password",
    authLimiter,
    forgotPasswordRules,
    forgotPasswordRequest,
);
router.post(
    "/reset-password/:resetToken",
    authLimiter,
    resetPasswordRules,
    resetForgotPassword,
);

// Signed in.
router.get("/current-user", verifyJWT, getCurrentUser);
router.post("/logout", verifyJWT, logoutUser);
router.patch("/profile", verifyJWT, profileRules, updateProfile);
router.patch("/avatar", verifyJWT, uploadAvatar, updateAvatar);
router.post(
    "/change-password",
    verifyJWT,
    changePasswordRules,
    changeCurrentPassword,
);
router.post(
    "/resend-email-verification",
    authLimiter,
    verifyJWT,
    resendEmailVerification,
);

export default router;
