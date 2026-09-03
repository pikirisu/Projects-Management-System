import multer from "multer";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ApiError } from "../utils/api-error.js";

const uploadDir = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public/images",
);

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

/**
 * Decides whether a single uploaded file is allowed through.
 * Called by multer before the file is written to disk, so a rejection here
 * means nothing untrusted ever lands in public/images.
 *
 * Call cb(null, true) to accept, cb(null, false) to drop silently, or
 * cb(new ApiError(415, "...")) to reject loudly via the central error handler.
 */
const fileFilter = (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const allowedExtensions = ALLOWED_UPLOAD_TYPES[file.mimetype];

    // Both signals must agree: an unknown MIME type, or a permitted MIME type
    // paired with an extension it does not own, is refused.
    if (!allowedExtensions || !allowedExtensions.includes(ext)) {
        return cb(new ApiError(415, "Invalid File Type"), false);
    }

    cb(null, true);
};

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        // Never reuse the client's filename: it carries an attacker-controlled
        // extension and two uploads in the same millisecond would collide.
        const ext = path.extname(file.originalname).toLowerCase();
        cb(null, `${crypto.randomUUID()}${ext}`);
    },
});

export const upload = multer({
    storage,
    fileFilter,
    limits: {
        fileSize: 1 * 1000 * 1000,
    },
});
