import { User } from "../models/user.models.js";
import { ApiResponse } from "../utils/Api-Response.js";
import { asyncHandler } from "../utils/async-handler.js";
import { ApiError } from "../utils/Api-Error.js";
import { generateEmailVerificationMail, sendMail } from "../utils/mail.js";

const generateAccessAndRefreshTokens = async function (userID) {
    const user = await User.findById(userID);

    if (!user) {
        throw new ApiError(404, "User not found.");
    }
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;
    await user.save({ validateBeforeSave: false });
    return { accessToken, refreshToken };
};

const registerUser = asyncHandler(async (req, res) => {
    const { username, email, password } = req.body;

    const existingUser = await User.findOne({
        $or: [{ username }, { email }],
    });

    if (existingUser) {
        throw new ApiError(
            409,
            "User with provided username or email already exists.",
            [],
        );
    }

    let user;

    try {
        user = await User.create({
            username,
            email,
            password,
            isEmailVerified: false,
        });

        const { unHashedToken, hashedToken, tokenExpiry } =
            user.generateTemporaryToken();

        user.emailVerificationToken = hashedToken;
        user.emailVerificationExpiry = tokenExpiry;

        await user.save({ validateBeforeSave: false });

        await sendMail({
            email: user.email,
            ...generateEmailVerificationMail({
                name: user.username,
                verificationToken: unHashedToken,
            }),
        });

        const createdUser = await User.findById(user._id).select(
            "-password -refreshToken -emailVerificationToken -emailVerificationExpiry",
        );

        if (!createdUser) {
            throw new ApiError(
                500,
                "Something went wrong while creating user.",
            );
        }

        return res
            .status(201)
            .json(
                new ApiResponse(
                    201,
                    createdUser,
                    "Registration successful. Please check your email to verify your account.",
                ),
            );
    } catch (error) {
        if (user) {
            await User.findByIdAndDelete(user._id);
        }

        throw error;
    }
});

export { registerUser };
