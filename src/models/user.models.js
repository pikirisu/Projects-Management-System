import mongoose, { Schema } from "mongoose";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { storedFileSchema } from "./stored-file.schema.js";

// Decision: secrets are opt-in. Every field marked `select: false` is left out
// of every query unless that query asks for it (`.select("+password")`), so no
// code path, including ones written later, can leak what it never loaded. The
// toJSON transform below is the backstop for anything loaded on purpose.
const PRIVATE_FIELDS = [
    "password",
    "refreshToken",
    "forgotPasswordToken",
    "forgotPasswordExpiry",
    "emailVerificationToken",
    "emailVerificationExpiry",
    "credentialsChangedAt",
];

// A real bcrypt hash of random bytes; see findByCredentials.
const DUMMY_HASH =
    "$2b$10$RGqlQV9eP.eNxm.OiYFdG.MFgbAVLplxB4uWVAGBB9aPLqa1AmGwa";

const userSchema = new Schema(
    {
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: { type: String, trim: true },
        avatar: storedFileSchema,
        password: { type: String, required: true, select: false },
        isEmailVerified: { type: Boolean, default: false },
        refreshToken: { type: String, select: false },
        // Access tokens issued before this instant are refused (isTokenStale).
        credentialsChangedAt: Date,
        forgotPasswordToken: { type: String, select: false },
        forgotPasswordExpiry: { type: Date, select: false },
        emailVerificationToken: { type: String, select: false },
        emailVerificationExpiry: { type: Date, select: false },
    },
    {
        timestamps: true,
        toJSON: {
            transform(_doc, ret) {
                for (const field of PRIVATE_FIELDS) delete ret[field];
                // Where an avatar is stored is the server's business; the
                // contract with clients is the URL.
                if (ret.avatar) ret.avatar = { url: ret.avatar.url };
                return ret;
            },
        },
    },
);

userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
});

// Decision: an unknown email and a wrong password are indistinguishable, in the
// response and in timing. A missing user still pays for one bcrypt compare, so
// response time cannot reveal which addresses have accounts.
userSchema.statics.findByCredentials = async function (email, password) {
    const user = await this.findOne({ email }).select("+password");
    const matches = await bcrypt.compare(
        password,
        user?.password ?? DUMMY_HASH,
    );
    return user && matches ? user : null;
};

userSchema.methods.isPasswordCorrect = function (password) {
    return bcrypt.compare(password, this.password);
};

// Decision: changing a password ends every session. Clearing the stored refresh
// token stops renewal; stamping credentialsChangedAt makes verifyJWT refuse the
// access tokens already issued, including one in an attacker's hands.
userSchema.methods.setPassword = function (password) {
    this.password = password;
    this.refreshToken = undefined;
    this.credentialsChangedAt = new Date();
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        { _id: this._id, email: this.email, username: this.username },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign({ _id: this._id }, process.env.REFRESH_TOKEN_SECRET, {
        expiresIn: process.env.REFRESH_TOKEN_EXPIRY,
    });
};

export const User = mongoose.model("User", userSchema);
