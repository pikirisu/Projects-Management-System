import { User } from "../models/user.models.js";
import { ProjectMember } from "../models/projectmember.models.js";
import { ApiError } from "../utils/api-error.js";
import { asyncHandler } from "../utils/async-handler.js";
import { isTokenStale } from "../utils/token-freshness.js";
import mongoose from "mongoose";
import jwt from "jsonwebtoken";

export const verifyJWT = asyncHandler(async (req, res, next) => {
    const token =
        req.cookies?.accessToken ||
        req.header("Authorization")?.replace("Bearer ", "");

    if (!token) {
        throw new ApiError(401, "Unauthorized request");
    }

    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET);
        // No .select() needed: every secret is select:false on the schema, so
        // this loads exactly the public fields plus credentialsChangedAt, which
        // the staleness check below reads.
        const user = await User.findById(decodedToken?._id);

        if (!user) {
            throw new ApiError(401, "Invalid access token");
        }

        // A password change or reset ends every session, including the ones
        // carrying an access token that has not expired yet.
        if (isTokenStale(decodedToken?.iat, user.credentialsChangedAt)) {
            throw new ApiError(401, "Invalid access token");
        }

        req.user = user;
        next();
    } catch {
        // The reason is deliberately dropped: "expired" and "signature
        // mismatch" are useful to an attacker and to nobody else. The catch
        // binding is omitted so that intent is not mistaken for an oversight.
        throw new ApiError(401, "Invalid access token");
    }
});

export const validateProjectPermission = (roles = []) => {
    return asyncHandler(async (req, res, next) => {
        const { projectId } = req.params;

        if (!projectId) {
            throw new ApiError(400, "Project id is missing");
        }

        const project = await ProjectMember.findOne({
            project: new mongoose.Types.ObjectId(projectId),
            user: new mongoose.Types.ObjectId(req.user._id),
        });

        /*
         * 404, not 403 and not 400. The request is well formed, so 400 is
         * simply the wrong class -- and answering 403 would confirm that the
         * project exists to anyone who guesses an id, which is the probe the
         * project-scoped 404s elsewhere in the API are written to prevent. A
         * project the caller is not a member of is indistinguishable from one
         * that does not exist, which is what it should look like.
         */
        if (!project) {
            throw new ApiError(404, "Project not found");
        }

        const givenRole = project ? project.role : undefined;

        req.user.role = givenRole;

        if (!roles.includes(givenRole)) {
            throw new ApiError(
                403,
                "You do not have permission to perform this action",
            );
        }

        return next();
    });
};
