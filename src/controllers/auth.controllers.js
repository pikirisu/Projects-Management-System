import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/api-response.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { buildVerificationLink } from "../utils/verification-link.js";
import { isTokenStale } from "../utils/token-freshness.js";
import { deleteAttachments, saveUpload } from "../utils/storage.js";
import {
    emailVerificationMailgenContent,
    forgotPasswordMailgenContent,
    sendEmail,
} from "../utils/mail.js";
import {
    accessCookieOptions,
    getCookieOptions,
    refreshCookieOptions,
} from "../utils/cookie-options.js";
import crypto from "crypto";
import jwt from "jsonwebtoken";

/*
 * Changing a password ends every other session.
 *
 * A reset is what someone does when they believe their account is compromised,
 * so it has to actually evict whoever else is holding it. Only one refresh
 * token is stored per user, and refreshAccessToken compares against it, so
 * clearing it makes every previously issued refresh token stop working.
 *
 * Access tokens are stateless JWTs and cannot be revoked one by one, so an
 * already-issued one stays valid until it expires. Clearing the refresh token
 * caps that residual window at a single ACCESS_TOKEN_EXPIRY instead of leaving
 * the attacker a session that renews itself for the life of the refresh token.
 */
const generateAccessAndRefreshTokens = async (userId) => {
    try {
        const user = await User.findById(userId);
        const accessToken = user.generateAccessToken();
        const refreshToken = user.generateRefreshToken();

        user.refreshToken = refreshToken;
        await user.save({ validateBeforeSave: false });
        return { accessToken, refreshToken };
    } catch (error) {
        // Reaching here means signing failed or the database refused the
        // write. The caller gets a generic 500, but an operator needs the
        // actual cause -- without this the log said nothing at all.
        console.error("[auth] could not issue tokens:", error);
        throw new ApiError(
            500,
            "Something went wrong while generating access token",
        );
    }
};

const registerUser = asyncHandler(async (req, res) => {
    const { email, username, password, fullName } = req.body;

    const existedUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existedUser) {
        throw new ApiError(
            409,
            "User with email or username already exists",
            [],
        );
    }

    const user = await User.create({
        email,
        password,
        username,
        // Optional, and undefined is left out rather than stored as "": the
        // model treats a missing name as "fall back to the username", and an
        // empty string would satisfy every truthiness check downstream while
        // rendering as nothing.
        ...(fullName?.trim() ? { fullName: fullName.trim() } : {}),
        isEmailVerified: false,
    });

    const { unHashedToken, hashedToken, tokenExpiry } =
        user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;

    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user?.email,
        subject: "Please verify your email",
        mailgenContent: emailVerificationMailgenContent(
            user.username,
            buildVerificationLink({
                clientUrl: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
                apiOrigin: `${req.protocol}://${req.get("host")}`,
                token: unHashedToken,
            }),
        ),
    });

    const createdUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
    );

    if (!createdUser) {
        throw new ApiError(
            500,
            "Something went wrong while registering a user",
        );
    }

    return res
        .status(201)
        .json(
            new ApiResponse(
                200,
                { user: createdUser },
                "User registered successfully and verification email has been sent on your email",
            ),
        );
});

const login = asyncHandler(async (req, res) => {
    const { email, password } = req.body;

    const user = await User.findOne({ email });

    // A distinct "user does not exist" message lets an attacker enumerate which
    // addresses are registered, so both failure modes answer identically.
    if (!user || !(await user.isPasswordCorrect(password))) {
        throw new ApiError(401, "Invalid credentials");
    }

    if (
        process.env.REQUIRE_EMAIL_VERIFICATION === "true" &&
        !user.isEmailVerified
    ) {
        throw new ApiError(
            403,
            "Please verify your email address before logging in",
        );
    }

    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
        user._id,
    );

    const loggedInUser = await User.findById(user._id).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
    );

    return res
        .status(200)
        .cookie("accessToken", accessToken, accessCookieOptions())
        .cookie("refreshToken", refreshToken, refreshCookieOptions())
        .json(
            new ApiResponse(
                200,
                {
                    user: loggedInUser,
                    accessToken,
                    refreshToken,
                },
                "User logged in successfully",
            ),
        );
});

const logoutUser = asyncHandler(async (req, res) => {
    await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: "",
            },
        },
        {
            new: true,
        },
    );
    return res
        .status(200)
        .clearCookie("accessToken", getCookieOptions())
        .clearCookie("refreshToken", getCookieOptions())
        .json(new ApiResponse(200, {}, "User logged out"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
    return res
        .status(200)
        .json(
            new ApiResponse(200, req.user, "Current user fetched successfully"),
        );
});

const verifyEmail = asyncHandler(async (req, res) => {
    const { verificationToken } = req.params;

    if (!verificationToken) {
        throw new ApiError(400, "Email verification token is missing");
    }

    let hashedToken = crypto
        .createHash("sha256")
        .update(verificationToken)
        .digest("hex");

    const user = await User.findOne({
        emailVerificationToken: hashedToken,
        emailVerificationExpiry: { $gt: Date.now() },
    });

    if (!user) {
        throw new ApiError(400, "Token is invalid or expired");
    }

    user.emailVerificationToken = undefined;
    user.emailVerificationExpiry = undefined;

    user.isEmailVerified = true;
    await user.save({ validateBeforeSave: false });

    return res.status(200).json(
        new ApiResponse(
            200,
            {
                isEmailVerified: true,
            },
            "Email is verified",
        ),
    );
});

const resendEmailVerification = asyncHandler(async (req, res) => {
    const user = await User.findById(req.user?._id);

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }
    if (user.isEmailVerified) {
        throw new ApiError(409, "Email is already verified");
    }

    const { unHashedToken, hashedToken, tokenExpiry } =
        user.generateTemporaryToken();

    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = tokenExpiry;

    await user.save({ validateBeforeSave: false });

    await sendEmail({
        email: user?.email,
        subject: "Please verify your email",
        mailgenContent: emailVerificationMailgenContent(
            user.username,
            buildVerificationLink({
                clientUrl: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
                apiOrigin: `${req.protocol}://${req.get("host")}`,
                token: unHashedToken,
            }),
        ),
    });

    return res
        .status(200)
        .json(new ApiResponse(200, {}, "Mail has been sent to your email ID"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
    const incomingRefreshToken =
        req.cookies.refreshToken || req.body.refreshToken;

    if (!incomingRefreshToken) {
        throw new ApiError(401, "Unauthorized access");
    }

    try {
        const decodedToken = jwt.verify(
            incomingRefreshToken,
            process.env.REFRESH_TOKEN_SECRET,
        );

        const user = await User.findById(decodedToken?._id);
        if (!user) {
            throw new ApiError(401, "Invalid refresh token");
        }

        if (incomingRefreshToken !== user?.refreshToken) {
            throw new ApiError(401, "Refresh token is expired");
        }

        // Belt and braces: clearing refreshToken on a password change already
        // fails the comparison above, but a future path that rotates the token
        // without clearing it would otherwise hand back a live session.
        if (isTokenStale(decodedToken?.iat, user.credentialsChangedAt)) {
            throw new ApiError(401, "Refresh token is expired");
        }

        const { accessToken, refreshToken: newRefreshToken } =
            await generateAccessAndRefreshTokens(user._id);

        // generateAccessAndRefreshTokens already persisted the rotated token;
        // re-saving here would write back a stale document instance.

        return res
            .status(200)
            .cookie("accessToken", accessToken, accessCookieOptions())
            .cookie("refreshToken", newRefreshToken, refreshCookieOptions())
            .json(
                new ApiResponse(
                    200,
                    { accessToken, refreshToken: newRefreshToken },
                    "Access token refreshed",
                ),
            );
    } catch {
        // Same reasoning as verifyJWT: a caller learns that the token was
        // rejected, never which check rejected it.
        throw new ApiError(401, "Invalid refresh token");
    }
});

const forgotPasswordRequest = asyncHandler(async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Respond identically whether or not the address exists: a 404 here would
    // turn this endpoint into an account-enumeration oracle.
    if (user) {
        const { unHashedToken, hashedToken, tokenExpiry } =
            user.generateTemporaryToken();

        user.forgotPasswordToken = hashedToken;
        user.forgotPasswordExpiry = tokenExpiry;

        await user.save({ validateBeforeSave: false });

        await sendEmail({
            email: user.email,
            subject: "Password reset request",
            mailgenContent: forgotPasswordMailgenContent(
                user.username,
                `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${unHashedToken}`,
            ),
        });
    }

    return res
        .status(200)
        .json(
            new ApiResponse(
                200,
                {},
                "Password reset mail has been sent on your mail id",
            ),
        );
});

const resetForgotPassword = asyncHandler(async (req, res) => {
    const { resetToken } = req.params;
    const { newPassword } = req.body;

    let hashedToken = crypto
        .createHash("sha256")
        .update(resetToken)
        .digest("hex");

    const user = await User.findOne({
        forgotPasswordToken: hashedToken,
        forgotPasswordExpiry: { $gt: Date.now() },
    });

    if (!user) {
        throw new ApiError(400, "Token is invalid or expired");
    }

    user.forgotPasswordExpiry = undefined;
    user.forgotPasswordToken = undefined;

    user.password = newPassword;
    // See the note above generateAccessAndRefreshTokens: the reset is the point
    // at which any session opened with the old password has to stop working.
    user.refreshToken = undefined;
    user.credentialsChangedAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .clearCookie("accessToken", getCookieOptions())
        .clearCookie("refreshToken", getCookieOptions())
        .json(new ApiResponse(200, {}, "Password reset successfully"));
});

const updateProfile = asyncHandler(async (req, res) => {
    const { fullName } = req.body;

    // Only fullName for now. username and email are identity: one is the
    // handle other members are shown, the other is what project invitations
    // are addressed to and what a password reset is sent to, so neither can
    // change without a verification flow of its own.
    const user = await User.findByIdAndUpdate(
        req.user._id,
        { $set: { fullName: fullName.trim() } },
        { new: true },
    ).select(
        "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
    );

    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Profile updated successfully"));
});

const updateAvatar = asyncHandler(async (req, res) => {
    if (!req.file) {
        // multer leaves req.file undefined when the field is absent, and an
        // empty <input type="file"> submits nothing at all -- so this is the
        // ordinary "pressed save without choosing anything" case, not an edge.
        throw new ApiError(400, "Choose an image to upload");
    }

    const user = await User.findById(req.user._id);
    if (!user) {
        throw new ApiError(404, "User does not exist");
    }

    const previous = user.avatar;
    const { url, provider, key, resourceType } = await saveUpload(req.file, {
        kind: "avatars",
    });

    user.avatar = { url, provider, key, resourceType };
    await user.save({ validateBeforeSave: false });

    /*
     * Only after the new one is stored and recorded. Deleting first would lose
     * the old image if the upload then failed, leaving the account with a
     * broken URL and no way back. The default placeholder carries no key, so
     * deleteAttachments skips it.
     */
    await deleteAttachments([previous]);

    return res
        .status(200)
        .json(new ApiResponse(200, user, "Photo updated successfully"));
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user?._id);

    const isPasswordValid = await user.isPasswordCorrect(oldPassword);

    if (!isPasswordValid) {
        throw new ApiError(400, "Invalid old Password");
    }

    user.password = newPassword;
    // Same reasoning as resetForgotPassword: other sessions must not survive.
    // The caller has to sign in again too, which is the honest tradeoff -- the
    // API cannot tell this request's own refresh token apart from any other.
    user.refreshToken = undefined;
    // Clearing the refresh token alone leaves already-issued access tokens
    // working until they expire. verifyJWT refuses anything older than this.
    user.credentialsChangedAt = new Date();
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .clearCookie("accessToken", getCookieOptions())
        .clearCookie("refreshToken", getCookieOptions())
        .json(new ApiResponse(200, {}, "Password changed successfully"));
});

export {
    registerUser,
    login,
    logoutUser,
    getCurrentUser,
    verifyEmail,
    resendEmailVerification,
    updateProfile,
    updateAvatar,
    refreshAccessToken,
    forgotPasswordRequest,
    changeCurrentPassword,
    resetForgotPassword,
};
