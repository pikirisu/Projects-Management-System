import { Monitor, Moon, Sun } from "lucide-react";
import {
    setThemePreference,
    useThemePreference,
    type ThemePreference,
} from "../lib/theme";
import { cx } from "./ui";

const OPTIONS: Array<{
    value: ThemePreference;
    label: string;
    Icon: typeof Sun;
}> = [
    { value: "light", label: "Light", Icon: Sun },
    { value: "dark", label: "Dark", Icon: Moon },
    { value: "system", label: "System", Icon: Monitor },
];

export function ThemeToggle({ className }: { className?: string }) {
    const preference = useThemePreference();

    return (
        <div
            role="group"
            aria-label="Theme"
            className={cx("inline-flex rounded-lg bg-sunken p-0.5", className)}
        >
            {OPTIONS.map(({ value, label, Icon }) => (
                <button
                    key={value}
                    type="button"
                    aria-pressed={preference === value}
                    aria-label={`${label} theme`}
                    title={`${label} theme`}
                    onClick={() => setThemePreference(value)}
                    className={cx(
                        "grid h-7 flex-1 place-items-center rounded-md px-2.5 transition-ui",
                        "focus-visible:outline-2 focus-visible:outline-indigo-600",
                        preference === value
                            ? "bg-surface text-strong shadow-raised"
                            : "text-faint hover:text-strong",
                    )}
                >
                    <Icon className="size-3.5" aria-hidden="true" />
                </button>
            ))}
        </div>
    );
}
