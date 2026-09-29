import mongoose, { Schema } from "mongoose";
import brcypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/*
 * Fields that must never reach a response body: credentials, the tokens that
 * can be exchanged for them, and internal session bookkeeping.
 *
 * Each query used to strip these by hand with .select("-password ..."), which
 * is a denylist maintained in one place per controller -- GET
 * /auth/current-user was returning forgotPasswordToken and
 * forgotPasswordExpiry because its list was written before those fields
 * existed and never revisited. Doing it on the schema instead means a field
 * added later is private by default rather than public by default.
 */
const PRIVATE_FIELDS = [
    "password",
    "refreshToken",
    "forgotPasswordToken",
    "forgotPasswordExpiry",
    "emailVerificationToken",
    "emailVerificationExpiry",
    "credentialsChangedAt",
];

const stripPrivateFields = (_doc, ret) => {
    for (const field of PRIVATE_FIELDS) {
        delete ret[field];
    }
    return ret;
};

const userSchema = new Schema(
    {
        avatar: {
            type: {
                url: String,
                localPath: String,
            },
            default: {
                url: `https://placehold.co/200x200`,
                localPath: "",
            },
        },
        username: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
            index: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true,
        },
        fullName: {
            type: String,
            trim: true,
        },
        password: {
            type: String,
            required: [true, "Password is required"],
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        refreshToken: {
            type: String,
        },
        /*
         * When this account's sessions were last invalidated. Access tokens
         * are stateless, so nothing else can evict one before it expires;
         * any token issued before this instant is refused. Unset on accounts
         * that have never changed a password.
         */
        credentialsChangedAt: {
            type: Date,
        },
        forgotPasswordToken: {
            type: String,
        },
        forgotPasswordExpiry: {
            type: Date,
        },
        emailVerificationToken: {
            type: String,
        },
        emailVerificationExpiry: {
            type: Date,
        },
    },
    {
        timestamps: true,
        /*
         * res.json() is JSON.stringify(), which calls toJSON() on every nested
         * document -- so this covers each route that answers with a user, and
         * any added later. The aggregation pipelines do not pass through here,
         * but they already $project an explicit allowlist of public fields.
         *
         * toObject is deliberately left alone: server-side code reads
         * this.password to compare a hash, and that has to keep working.
         */
        toJSON: { transform: stripPrivateFields },
    },
);

userSchema.pre("save", async function () {
    if (!this.isModified("password")) return;

    this.password = await brcypt.hash(this.password, 10);
});

userSchema.methods.isPasswordCorrect = async function (password) {
    return await brcypt.compare(password, this.password);
};

userSchema.methods.generateAccessToken = function () {
    return jwt.sign(
        {
            _id: this._id,
            email: this.email,
            username: this.username,
        },
        process.env.ACCESS_TOKEN_SECRET,
        { expiresIn: process.env.ACCESS_TOKEN_EXPIRY },
    );
};

userSchema.methods.generateRefreshToken = function () {
    return jwt.sign(
        {
            _id: this._id,
        },
        process.env.REFRESH_TOKEN_SECRET,
        { expiresIn: process.env.REFRESH_TOKEN_EXPIRY },
    );
};

userSchema.methods.generateTemporaryToken = function () {
    const unHashedToken = crypto.randomBytes(20).toString("hex");

    const hashedToken = crypto
        .createHash("sha256")
        .update(unHashedToken)
        .digest("hex");

    const tokenExpiry = Date.now() + 20 * 60 * 1000; //20 mins
    return { unHashedToken, hashedToken, tokenExpiry };
};

export const User = mongoose.model("User", userSchema);
