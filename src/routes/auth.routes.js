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
import {
    AVATAR_FIELD,
    uploadAvatar,
} from "../middlewares/multer.middleware.js";
import { validate } from "../middlewares/validator.middleware.js";
import {
    userChangeCurrentPasswordValidator,
    userForgotPasswordValidator,
    userLoginValidator,
    userRegisterValidator,
    userResetForgotPasswordValidator,
    userUpdateProfileValidator,
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
    .route("/profile")
    .patch(verifyJWT, userUpdateProfileValidator(), validate, updateProfile);
// Multipart, so no express-validator chain: the body is parsed by multer, and
// what there is to validate about the file -- type, size, count -- multer has
// already decided by the time the controller runs.
router
    .route("/avatar")
    .patch(verifyJWT, uploadAvatar.single(AVATAR_FIELD), updateAvatar);
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
