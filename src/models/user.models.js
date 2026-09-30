import mongoose, { Schema } from "mongoose";
import brcypt from "bcrypt";
import jwt from "jsonwebtoken";
import crypto from "crypto";

/*
 * Two layers keep secrets out of a response, and they guard different things.
 *
 * `select: false` on the fields below means a query does not load them at all
 * unless it asks: `.select("+password")`. That is the layer that matters,
 * because a field nobody loaded cannot be leaked by any code path, including
 * ones written later. Only three places need one -- signing in, changing a
 * password, and comparing a refresh token -- and each says so at the call site.
 *
 * The toJSON transform below is the backstop for anything that *is* loaded
 * deliberately and then serialized by accident.
 *
 * Both replaced a `.select("-password -refreshToken ...")` denylist repeated
 * at four call sites. A denylist has to be updated every time the schema
 * grows, and this one was not: GET /auth/current-user returned
 * forgotPasswordToken and forgotPasswordExpiry for as long as those fields
 * existed, because its list predated them.
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
                // Which local directory holds it; see src/utils/storage.js.
                folder: String,
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
            select: false,
            required: [true, "Password is required"],
        },
        isEmailVerified: {
            type: Boolean,
            default: false,
        },
        refreshToken: {
            type: String,
            select: false,
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
            select: false,
        },
        forgotPasswordExpiry: {
            type: Date,
            select: false,
        },
        emailVerificationToken: {
            type: String,
            select: false,
        },
        emailVerificationExpiry: {
            type: Date,
            select: false,
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
