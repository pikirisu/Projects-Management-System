import { displayName, initials } from "../../lib/display";
import type { User } from "../../lib/types";
import { cx } from "./cx";

const SIZES = {
    sm: "size-6 text-[10px]",
    md: "size-8 text-xs",
    lg: "size-14 text-base",
};

// Older accounts store a placehold.co URL as their photo. Initials are faster
// than fetching an identical grey box per person, and identify them.
const PLACEHOLDER = /placehold\.co/i;

export function Avatar({
    src,
    initials: letters,
    title,
    size = "md",
    className,
}: {
    src?: string;
    initials: string;
    title?: string;
    size?: keyof typeof SIZES;
    className?: string;
}) {
    const base = cx(
        SIZES[size],
        "shrink-0 rounded-full ring-2 ring-surface",
        className,
    );

    if (src && !PLACEHOLDER.test(src)) {
        return (
            <img
                src={src}
                alt=""
                title={title}
                className={cx(base, "object-cover")}
            />
        );
    }

    return (
        <span
            title={title}
            aria-hidden="true"
            className={cx(
                base,
                "grid place-items-center bg-sunken font-semibold text-muted",
            )}
        >
            {letters}
        </span>
    );
}

/** An avatar for a user, or for "nobody" when `user` is null. */
export function UserAvatar({
    user,
    size,
    title,
}: {
    user: User | null;
    size?: keyof typeof SIZES;
    title?: string;
}) {
    return (
        <Avatar
            src={user?.avatar?.url}
            initials={initials(user)}
            title={title ?? displayName(user)}
            size={size}
        />
    );
}

/** Overlapping avatars, then "+N" past `max`. */
export function AvatarStack({
    users,
    max = 4,
}: {
    users: User[];
    max?: number;
}) {
    const shown = users.slice(0, max);
    const rest = users.length - shown.length;

    return (
        <div className="flex items-center -space-x-1.5">
            {shown.map((user) => (
                <UserAvatar key={user._id} user={user} size="sm" />
            ))}
            {rest > 0 && (
                <span className="grid size-6 place-items-center rounded-full bg-sunken text-[10px] font-semibold text-muted ring-2 ring-surface">
                    +{rest}
                </span>
            )}
        </div>
    );
}
