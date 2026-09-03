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
    verifyEmail,
} from "../controllers/auth.controllers.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userLoginValidator,
    userRegisterValidator,
    userResetForgotPasswordValidator,
} from "../validators/index.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { authLimiter } from "../middlewares/rate-limit.middleware.js";

const router = Router();

// unsecured route
// authLimiter guards the credential- and token-guessing surface.
router
    .route("/register")
    .post(authLimiter, userRegisterValidator(), validate, registerUser);
router.route("/login").post(authLimiter, userLoginValidator(), validate, login);
router.route("/verify-email/:verificationToken").get(authLimiter, verifyEmail);
router.route("/refresh-token").post(authLimiter, refreshAccessToken);
router
    .route("/forgot-password")
    .post(
        authLimiter,
        userForgotPasswordValidator(),
        validate,
        forgotPasswordRequest,
    );
router
    .route("/reset-password/:resetToken")
    .post(
        authLimiter,
        userResetForgotPasswordValidator(),
        validate,
        resetForgotPassword,
    );

//secure routes
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/current-user").get(verifyJWT, getCurrentUser);
router
    .route("/change-password")
    .post(
        verifyJWT,
        userChangeCurrentPasswordValidator(),
        validate,
        changeCurrentPassword,
    );
router
    .route("/resend-email-verification")
    .post(authLimiter, verifyJWT, resendEmailVerification);

export default router;
