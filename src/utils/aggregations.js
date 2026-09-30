/**
 * The public shape of a user inside an aggregation result.
 *
 * Aggregation pipelines do not pass through the schema's toJSON transform, so
 * they are the one place a user's storage bookkeeping could still reach a
 * client. This allowlist is the counterpart to that transform, and it was
 * written out three times -- the project member list, a task's assignee, and a
 * subtask's creator -- which is three places to remember when the model grows.
 */
export const PUBLIC_USER_FIELDS = {
    _id: 1,
    username: 1,
    fullName: 1,
    // The URL only. Projecting the whole avatar subdocument would hand out the
    // storage provider and key that every other route strips.
    "avatar.url": 1,
};

/**
 * $lookup for a single referenced user, projected down to the public fields.
 *
 * @param {string} field - the local field holding the user id; the joined
 *   result is written back to the same name, which is what lets the callers
 *   `$first` it into place afterwards.
 */
export const lookupUser = (field) => ({
    $lookup: {
        from: "users",
        localField: field,
        foreignField: "_id",
        as: field,
        pipeline: [{ $project: PUBLIC_USER_FIELDS }],
    },
});
