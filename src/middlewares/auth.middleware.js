import { ProjectMember } from "../models/projectmember.models.js";
import { User } from "../models/user.models.js";
import { ApiError } from "../utils/api-error.js";
import { ALL_ROLES, MANAGER_ROLES, ROLES } from "../utils/constants.js";
import { isTokenStale, verifyToken } from "../utils/tokens.js";

/** Loads the signed-in user from the access token (cookie or Bearer header). */
export async function verifyJWT(req, res, next) {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");
    const payload =
        token && verifyToken(token, process.env.ACCESS_TOKEN_SECRET);
    const user = payload && (await User.findById(payload._id));

    // Decision: missing, expired, forged and revoked tokens all get the same
    // 401. Which check failed is useful only to an attacker.
    if (!user || isTokenStale(payload.iat, user.credentialsChangedAt)) {
        throw new ApiError(401, "Invalid access token");
    }

    req.user = user;
    next();
}

const demoEmails = () =>
    (process.env.DEMO_EMAILS ?? "")
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean);

// Decision: the demo accounts are shared by every visitor, so no visitor may
// lock out or deface them for the next one. Their password, photo and name are
// fixed; everything else they touch is restored by the nightly reset.
export function notForDemoAccounts(req, res, next) {
    if (demoEmails().includes(req.user.email)) {
        throw new ApiError(
            403,
            "The demo account is shared, so its sign-in and profile stay as they are. Create your own account to try this.",
        );
    }
    next();
}

/**
 * Resolves the caller's role on :projectId into `req.projectRole` and refuses
 * anyone whose role is not in `roles`.
 */
const requireProjectRole = (roles) =>
    async function (req, res, next) {
        const membership = await ProjectMember.findOne({
            project: req.params.projectId,
            user: req.user._id,
        });

        // Decision: a project you are not a member of answers 404, exactly like
        // one that does not exist, so the status cannot reveal which ids are real.
        if (!membership) {
            throw new ApiError(404, "Project not found");
        }
        if (!roles.includes(membership.role)) {
            throw new ApiError(
                403,
                "You do not have permission to perform this action",
            );
        }

        req.projectRole = membership.role;
        next();
    };

export const anyMember = requireProjectRole(ALL_ROLES);
export const managersOnly = requireProjectRole(MANAGER_ROLES);
export const adminsOnly = requireProjectRole([ROLES.ADMIN]);
