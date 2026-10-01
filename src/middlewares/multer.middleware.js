import multer from "multer";
import path from "node:path";
import { ApiError } from "../utils/api-error.js";

// Decision: a file is accepted only when its MIME type is allowlisted AND its
// extension belongs to that type, which also refuses "a.txt.html". SVG is left
// out on purpose: it is XML that can carry an inline <script>.
const IMAGE_TYPES = {
    "image/jpeg": [".jpg", ".jpeg"],
    "image/png": [".png"],
    "image/gif": [".gif"],
    "image/webp": [".webp"],
};

const ATTACHMENT_TYPES = {
    ...IMAGE_TYPES,
    "application/pdf": [".pdf"],
    "text/plain": [".txt", ".md"],
};

export const ATTACHMENT_FIELD = "attachments";
export const MAX_ATTACHMENTS = 5;
export const AVATAR_FIELD = "avatar";

// Files are buffered in memory, bounded by `limits`, and src/utils/storage.js
// decides where they land, so a refused file is never written anywhere.
const createUploader = (types, limits) =>
    multer({
        storage: multer.memoryStorage(),
        limits,
        fileFilter(req, file, cb) {
            const ext = path.extname(file.originalname).toLowerCase();
            const allowed = Boolean(types[file.mimetype]?.includes(ext));
            cb(
                allowed ? null : new ApiError(415, "Invalid file type"),
                allowed,
            );
        },
    });

export const uploadAttachments = createUploader(ATTACHMENT_TYPES, {
    fileSize: 1_000_000,
}).array(ATTACHMENT_FIELD, MAX_ATTACHMENTS);

// Smaller than an attachment: an avatar is loaded on every screen showing it.
export const uploadAvatar = createUploader(IMAGE_TYPES, {
    fileSize: 512_000,
    files: 1,
}).single(AVATAR_FIELD);
