import multer from "multer";
import path from "node:path";
import { ApiError } from "../utils/api-error.js";

// Maps an accepted MIME type to the extensions we will accept alongside it.
// Anything a browser might execute in our own origin must stay off this list.
// Note the deliberate absence of image/svg+xml: an SVG is XML and can carry an
// inline <script>, which would run as same-origin JavaScript if ever rendered.
export const ALLOWED_UPLOAD_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
    "application/pdf": [".pdf"],
    "text/plain": [".txt", ".md"],
};

// Avatars are rendered in an <img>, so this list is narrower than the one
// above: a PDF or a .txt is a perfectly good attachment and a nonsense photo.
export const ALLOWED_AVATAR_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
};

/**
 * Builds multer's fileFilter for one allowlist.
 * Called before the file is buffered, so a rejection means nothing untrusted is
 * ever handed to the storage layer.
 *
 * Call cb(null, true) to accept, cb(null, false) to drop silently, or
 * cb(new ApiError(415, "...")) to reject loudly via the central error handler.
 */
const fileFilterFor = (allowed) => (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = allowed[file.mimetype];

    // Both signals must agree: an unknown MIME type, or a permitted MIME type
    // paired with an extension it does not own, is refused.
    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
        return cb(new ApiError(415, "Invalid File Type"), false);
    }

    cb(null, true);
};

// Files are buffered in memory and handed to src/utils/storage.js, which owns
// the choice between Cloudinary and local disk. Multer no longer decides where
// bytes land, so the same request path works on an ephemeral PaaS filesystem
// and on a laptop.
//
/**
 * The field a task's files arrive under, and how many of them are accepted.
 * Exported so the routes and the error handler agree on both: multer reports a
 * sixth file as LIMIT_UNEXPECTED_FILE on this field, which is indistinguishable
 * from a genuinely unknown field unless the handler knows the expected name.
 */
export const ATTACHMENT_FIELD = "attachments";
export const MAX_ATTACHMENTS = 5;

// Memory is bounded by the limits below and by MAX_ATTACHMENTS, applied by
// upload.array in the task routes: at most 5 files per request at 1 MB each.
export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilterFor(ALLOWED_UPLOAD_TYPES),
    limits: {
        fileSize: 1 * 1000 * 1000,
    },
});

/** The field a profile photo arrives under. */
export const AVATAR_FIELD = "avatar";

// One image, and a smaller cap than an attachment: this one is rendered on
// every screen that shows the user, so a megabyte of it is a megabyte on every
// page load.
export const uploadAvatar = multer({
    storage: multer.memoryStorage(),
    fileFilter: fileFilterFor(ALLOWED_AVATAR_TYPES),
    limits: {
        fileSize: 512 * 1000,
        files: 1,
    },
});
