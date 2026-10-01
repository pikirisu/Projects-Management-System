import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { ApiResponse, respond } from "../utils/api-response.js";
import {
    accessCookieOptions,
    getCookieOptions,
    refreshCookieOptions,
} from "../utils/cookie-options.js";
import {
    passwordResetEmail,
    sendEmail,
    verificationEmail,
} from "../utils/mail.js";
import { deleteStoredFiles, saveUpload } from "../utils/storage.js";
import {
    createTemporaryToken,
    hashToken,
    isTokenStale,
    verifyToken,
} from "../utils/tokens.js";
import { buildVerificationLink } from "../utils/verification-link.js";

// ---- helpers -----------------------------------------------------------------

/**
 * Rotates the refresh token and answers with a fresh pair, both as httpOnly
 * cookies (for browsers) and in the body (for Bearer clients).
 */
async function issueSession(res, user, message) {
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();
    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });

    return res
        .status(200)
        .cookie("accessToken", accessToken, accessCookieOptions())
        .cookie("refreshToken", refreshToken, refreshCookieOptions())
        .json(
            new ApiResponse(200, { user, accessToken, refreshToken }, message),
        );
}

function clearSession(res, message) {
    return res
        .status(200)
        .clearCookie("accessToken", getCookieOptions())
        .clearCookie("refreshToken", getCookieOptions())
        .json(new ApiResponse(200, {}, message));
}

/** Puts a fresh verification token on `user` (unsaved); returns the raw one. */
function issueEmailVerification(user) {
    const { token, hashedToken, expiresAt } = createTemporaryToken();
    user.emailVerificationToken = hashedToken;
    user.emailVerificationExpiry = expiresAt;
    return token;
}

// Decision: emails are sent without awaiting them. sendEmail logs and swallows
// its own failures, so neither a request's latency nor its outcome depends on
// the SMTP server.
function sendVerificationEmail(req, user, token) {
    const link = buildVerificationLink({
        clientUrl: process.env.EMAIL_VERIFICATION_REDIRECT_URL,
        apiOrigin: `${req.protocol}://${req.get("host")}`,
        token,
    });
    void sendEmail({
        to: user.email,
        subject: "Please verify your email",
        content: verificationEmail(user.username, link),
    });
}

// ---- public ------------------------------------------------------------------

export async function registerUser(req, res) {
    const { email, username, password, fullName } = req.body;

    // Decision: no "does this user exist?" read first. The unique indexes on
    // email and username refuse a duplicate atomically, and the error handler
    // answers 409 naming the field: one write instead of three round trips,
    // and no window for two sign-ups to race.
    const user = new User({
        email,
        username,
        password,
        fullName: fullName || undefined,
    });
    const token = issueEmailVerification(user);
    await user.save();
    sendVerificationEmail(req, user, token);

    return respond(
        res,
        { user },
        "Account created. Check your email to verify your address.",
        201,
    );
}

export async function login(req, res) {
    const user = await User.findByCredentials(
        req.body.email,
        req.body.password,
    );
    if (!user) {
        throw new ApiError(401, "Invalid credentials");
    }

    if (
        process.env.REQUIRE_EMAIL_VERIFICATION === "true" &&
        !user.isEmailVerified
    ) {
        throw new ApiError(
            403,
            "Please verify your email address before signing in",
        );
    }

    return issueSession(res, user, "Signed in");
}

export async function refreshAccessToken(req, res) {
    const incoming = req.cookies?.refreshToken || req.body.refreshToken;
    const payload =
        incoming && verifyToken(incoming, process.env.REFRESH_TOKEN_SECRET);
    const user =
        payload && (await User.findById(payload._id).select("+refreshToken"));

    // Decision: refresh tokens rotate and only the latest is stored, so a
    // replayed token, or one issued before a password change, fails here with
    // the same 401 as a forged one.
    if (
        !user ||
        user.refreshToken !== incoming ||
        isTokenStale(payload.iat, user.credentialsChangedAt)
    ) {
        throw new ApiError(401, "Invalid refresh token");
    }

    return issueSession(res, user, "Access token refreshed");
}

export async function verifyEmail(req, res) {
    // One atomic update, so a link clicked twice at once verifies only once.
    const user = await User.findOneAndUpdate(
        {
            emailVerificationToken: hashToken(req.params.verificationToken),
            emailVerificationExpiry: { $gt: new Date() },
        },
        {
            $set: { isEmailVerified: true },
            $unset: { emailVerificationToken: 1, emailVerificationExpiry: 1 },
        },
    );
    if (!user) {
        throw new ApiError(400, "This link is invalid or has expired");
    }

    return respond(res, { isEmailVerified: true }, "Email verified");
}

export async function forgotPasswordRequest(req, res) {
    const user = await User.findOne({ email: req.body.email });

    // Decision: the same 200 whether or not the address has an account, so this
    // endpoint cannot be used to discover who has signed up.
    if (user) {
        const { token, hashedToken, expiresAt } = createTemporaryToken();
        user.forgotPasswordToken = hashedToken;
        user.forgotPasswordExpiry = expiresAt;
        await user.save({ validateBeforeSave: false });

        void sendEmail({
            to: user.email,
            subject: "Reset your password",
            content: passwordResetEmail(
                user.username,
                `${process.env.FORGOT_PASSWORD_REDIRECT_URL}/${token}`,
            ),
        });
    }

    return respond(
        res,
        {},
        "If that address has an account, a reset link is on its way",
    );
}

export async function resetForgotPassword(req, res) {
    const user = await User.findOne({
        forgotPasswordToken: hashToken(req.params.resetToken),
        forgotPasswordExpiry: { $gt: new Date() },
    });
    if (!user) {
        throw new ApiError(400, "This link is invalid or has expired");
    }

    user.forgotPasswordToken = undefined;
    user.forgotPasswordExpiry = undefined;
    user.setPassword(req.body.newPassword);
    await user.save({ validateBeforeSave: false });

    return clearSession(res, "Password reset. Sign in with your new password.");
}

// ---- signed in ---------------------------------------------------------------

export function getCurrentUser(req, res) {
    return respond(res, req.user, "Current user");
}

export async function logoutUser(req, res) {
    await User.updateOne(
        { _id: req.user._id },
        { $unset: { refreshToken: 1 } },
    );
    return clearSession(res, "Signed out");
}

export async function changeCurrentPassword(req, res) {
    const { oldPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select("+password");

    if (!(await user.isPasswordCorrect(oldPassword))) {
        throw new ApiError(400, "Current password is incorrect");
    }

    // Ends this session too: the API cannot tell the caller's own refresh
    // token apart from anyone else's.
    user.setPassword(newPassword);
    await user.save({ validateBeforeSave: false });

    return clearSession(
        res,
        "Password changed. Sign in again on every device.",
    );
}

export async function resendEmailVerification(req, res) {
    const user = req.user;
    if (user.isEmailVerified) {
        throw new ApiError(409, "Email is already verified");
    }

    const token = issueEmailVerification(user);
    await user.save({ validateBeforeSave: false });
    sendVerificationEmail(req, user, token);

    return respond(res, {}, "Verification email sent");
}

export async function updateProfile(req, res) {
    // Only the display name. Username and email are identity: changing either
    // would need a verification flow of its own.
    req.user.fullName = req.body.fullName;
    await req.user.save({ validateBeforeSave: false });

    return respond(res, req.user, "Profile updated");
}

export async function updateAvatar(req, res) {
    if (!req.file) {
        throw new ApiError(400, "Choose an image to upload");
    }

    const previous = req.user.avatar?.toObject();
    req.user.avatar = await saveUpload(req.file, "avatars");
    await req.user.save({ validateBeforeSave: false });

    // Only after the new image is stored and recorded, so a failed upload can
    // never leave the account pointing at a deleted file.
    await deleteStoredFiles([previous]);

    return respond(res, req.user, "Photo updated");
}
