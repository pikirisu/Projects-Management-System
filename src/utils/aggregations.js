/**
 * The public shape of a user inside an aggregation. Aggregations bypass the
 * schema's toJSON transform, so they need this allowlist of their own.
 */
export const PUBLIC_USER_FIELDS = {
    _id: 1,
    username: 1,
    fullName: 1,
    "avatar.url": 1,
};

/**
 * Pipeline stages that replace the user id in `field` with that user's public
 * fields. The field is left out when no user matches.
 */
export const lookupUser = (field) => [
    {
        $lookup: {
            from: "users",
            localField: field,
            foreignField: "_id",
            as: field,
            pipeline: [{ $project: PUBLIC_USER_FIELDS }],
        },
    },
    { $set: { [field]: { $first: `$${field}` } } },
];
