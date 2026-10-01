import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { v2 as cloudinary } from "cloudinary";

export const PUBLIC_DIR = path.resolve(
    path.dirname(fileURLToPath(import.meta.url)),
    "../../public",
);

/**
 * The two kinds of upload. They live in separate directories because app.js
 * serves them with different headers: attachments download, avatars render.
 */
export const UPLOAD_KINDS = {
    attachments: {
        dir: path.join(PUBLIC_DIR, "images"),
        urlPath: "images",
        cloudFolder: "project-camp/attachments",
    },
    avatars: {
        dir: path.join(PUBLIC_DIR, "avatars"),
        urlPath: "avatars",
        cloudFolder: "project-camp/avatars",
    },
};

const kindOf = (name) =>
    Object.hasOwn(UPLOAD_KINDS, name)
        ? UPLOAD_KINDS[name]
        : UPLOAD_KINDS.attachments;

// Decision: Cloudinary when its credentials are set, local disk otherwise. A
// PaaS filesystem is wiped on every redeploy, so production needs the former;
// CI and local development run without a third-party account on the latter.
const useCloudinary = () =>
    Boolean(
        process.env.CLOUDINARY_CLOUD_NAME &&
        process.env.CLOUDINARY_API_KEY &&
        process.env.CLOUDINARY_API_SECRET,
    );

let cloudinaryReady = false;

function cloudinaryClient() {
    if (!cloudinaryReady) {
        cloudinary.config({
            cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
            api_key: process.env.CLOUDINARY_API_KEY,
            api_secret: process.env.CLOUDINARY_API_SECRET,
            secure: true,
        });
        cloudinaryReady = true;
    }
    return cloudinary;
}

const uploadToCloudinary = (file, folder) =>
    new Promise((resolve, reject) => {
        cloudinaryClient()
            .uploader.upload_stream(
                // "auto" classifies images vs raw files; destroy() needs the result.
                { folder, resource_type: "auto" },
                (error, result) => (error ? reject(error) : resolve(result)),
            )
            .end(file.buffer);
    });

/**
 * Stores one multer file and returns the subdocument to persist. `provider`,
 * `key`, `resourceType` and `folder` are what deleteStoredFiles needs later.
 */
export async function saveUpload(file, kind = "attachments") {
    const { dir, urlPath, cloudFolder } = kindOf(kind);
    const base = { mimetype: file.mimetype, size: file.size, folder: kind };

    if (useCloudinary()) {
        const result = await uploadToCloudinary(file, cloudFolder);
        return {
            ...base,
            url: result.secure_url,
            provider: "cloudinary",
            key: result.public_id,
            resourceType: result.resource_type,
        };
    }

    // Never reuse the client's filename: it is attacker-controlled.
    const ext = path.extname(file.originalname).toLowerCase();
    const key = `${crypto.randomUUID()}${ext}`;
    await fs.mkdir(dir, { recursive: true });
    await fs.writeFile(path.join(dir, key), file.buffer);

    return {
        ...base,
        url: `${process.env.SERVER_URL}/${urlPath}/${key}`,
        provider: "local",
        key,
    };
}

// Decision: local keys are server-generated UUIDs, but a row restored from a
// backup or edited by hand could hold "../../src/app.js". The key is resolved
// first and refused if it lands outside the upload directory, so a delete can
// never escape it. An unknown folder falls back to attachments, never wider.
export function resolveLocalPath(key, folder = "attachments") {
    const { dir } = kindOf(folder);
    const resolved = path.resolve(dir, key);

    if (resolved !== path.join(dir, path.basename(resolved))) {
        throw new Error(
            `refusing to delete outside the upload directory: ${key}`,
        );
    }
    return resolved;
}

/**
 * Best-effort cleanup for anything saveUpload returned. Failures are logged,
 * not thrown: the row is already gone, and an orphaned blob is not worth
 * failing the request over. Entries without a `key` (old rows) are skipped.
 */
export async function deleteStoredFiles(files = []) {
    await Promise.all(
        files.map(async (file) => {
            if (!file?.key) return;
            try {
                if (file.provider === "cloudinary") {
                    await cloudinaryClient().uploader.destroy(file.key, {
                        resource_type: file.resourceType || "image",
                    });
                } else {
                    await fs.unlink(resolveLocalPath(file.key, file.folder));
                }
            } catch (error) {
                console.error(
                    `[storage] could not delete ${file.key}:`,
                    error?.message,
                );
            }
        }),
    );
}
