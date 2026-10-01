import { Schema } from "mongoose";

/**
 * A file written by src/utils/storage.js: a task attachment or an avatar.
 * Only `url` is for clients; the rest is what makes the file deletable later.
 */
export const storedFileSchema = new Schema({
    url: String,
    mimetype: String,
    size: Number,
    provider: String,
    key: String,
    resourceType: String,
    folder: String,
});
