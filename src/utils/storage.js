import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

const LOCAL_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public/images",
);

// Keeps uploads in their own namespace inside the Cloudinary account.
const CLOUD_FOLDER = "project-camp/attachments";

// Attachment bytes reach this module in memory (see multer.middleware.js) and
// this is the only place that decides where they land. Two drivers:
//
//   cloudinary - used when credentials are present. Survives redeploys, which
//                matters because a PaaS filesystem is ephemeral: anything
//                written to public/images is gone on the next restart.
//   local      - the fallback. Keeps CI hermetic, so the end-to-end suite runs
//                on fork pull requests without needing a third-party secret,
//                and keeps `npm run dev` working with no signup.
//
// Resolved per call rather than at module load so import ordering cannot decide
// which driver is active.
const isCloudinaryConfigured = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    );

export const activeStorageProvider = () =>
    isCloudinaryConfigured() ? "cloudinary" : "local";

const configureCloudinary = () => {
    cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET,
        secure: true,
    });
};

// The SDK's buffer path is a write stream with a callback, not a promise.
const uploadToCloudinary = (file) =>
    new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
            {
                folder: CLOUD_FOLDER,
                // "auto" lets Cloudinary classify images vs. raw files (txt, md)
                // itself; the resolved type comes back on the result and has to
                // be stored, because destroy() needs it later.
                resource_type: "auto",
            },
            (error, result) => (error ? reject(error) : resolve(result)),
        );
        stream.end(file.buffer);
    });

const saveLocally = async (file) => {
    await fs.mkdir(LOCAL_DIR, { recursive: true });
    // Never reuse the client's filename: it carries an attacker-controlled
    // extension, and two uploads in the same millisecond would collide.
    const ext = path.extname(file.originalname).toLowerCase();
    const key = `${crypto.randomUUID()}${ext}`;
    await fs.writeFile(path.join(LOCAL_DIR, key), file.buffer);
    return {
        url: `${process.env.SERVER_URL}/images/${key}`,
        key,
        resourceType: "local",
    };
};

/**
 * Persists one uploaded file and returns the attachment subdocument to store.
 * `provider` and `key` are what make deletion possible later -- without them a
 * removed task would leave its blobs orphaned in Cloudinary forever.
 */
export const saveAttachment = async (file) => {
    const base = { mimetype: file.mimetype, size: file.size };

    if (isCloudinaryConfigured()) {
        configureCloudinary();
        const result = await uploadToCloudinary(file);
        return {
            ...base,
            url: result.secure_url,
            provider: "cloudinary",
            key: result.public_id,
            resourceType: result.resource_type,
        };
    }

    const { url, key, resourceType } = await saveLocally(file);
    return { ...base, url, provider: "local", key, resourceType };
};

/**
 * Best-effort cleanup of stored blobs. Failures are logged, never thrown: the
 * task row is already gone by the time this runs, and an orphaned blob is not
 * worth turning a successful delete into a 500 for the caller.
 *
 * Attachments written before this module existed have no `key`, so they are
 * skipped rather than crashing on undefined.
 */
export const deleteAttachments = async (attachments = []) => {
    await Promise.all(
        attachments.map(async (attachment) => {
            if (!attachment?.key) return;
            try {
                if (attachment.provider === "cloudinary") {
                    configureCloudinary();
                    await cloudinary.uploader.destroy(attachment.key, {
                        resource_type: attachment.resourceType || "image",
                    });
                } else {
                    await fs.unlink(path.join(LOCAL_DIR, attachment.key));
                }
            } catch (error) {
                console.error(
                    `[storage] could not delete attachment ${attachment.key}:`,
                    error?.message,
                );
            }
        }),
    );
};
