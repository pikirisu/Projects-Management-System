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

/**
 * Decides whether a single uploaded file is allowed through.
 * Called by multer before the file is buffered, so a rejection here means
 * nothing untrusted is ever handed to the storage layer.
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

// Files are buffered in memory and handed to src/utils/storage.js, which owns
// the choice between Cloudinary and local disk. Multer no longer decides where
// bytes land, so the same request path works on an ephemeral PaaS filesystem
// and on a laptop.
//
// Memory is bounded by the limits below: at most 5 files per request (set by
// upload.array in the task routes) at 1 MB each.
export const upload = multer({
    storage: multer.memoryStorage(),
    fileFilter,
    limits: {
        fileSize: 1 * 1000 * 1000,
    },
});
