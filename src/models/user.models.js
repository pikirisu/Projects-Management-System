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

    /*
     * The avatar carries provider/key/resourceType so the old image can be
     * deleted when a new one replaces it. None of that is a secret -- both are
     * recoverable from the URL -- but it is storage bookkeeping, and sending it
     * invites a client to depend on where the bytes happen to live. The
     * contract is the URL.
     */
    if (ret.avatar) {
        ret.avatar = { url: ret.avatar.url };
    }

    return ret;
};

const userSchema = new Schema(
    {
        /*
         * provider/key/resourceType are what make the old image deletable when
         * a new one is uploaded -- the same trio a task attachment carries. The
         * default has none of them, which is how the placeholder is recognised
         * as having no stored blob behind it.
         *
         * `localPath` used to sit here. Nothing ever wrote or read it.
         */
        avatar: {
            type: {
                url: String,
                provider: String,
                key: String,
                resourceType: String,
            },
            default: {
                url: `https://placehold.co/200x200`,
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
