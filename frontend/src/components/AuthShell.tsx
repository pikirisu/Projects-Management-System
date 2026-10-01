import type { ReactNode } from "react";
import { SquareKanban, ListChecks, ShieldCheck } from "lucide-react";
import { ApiStatusBanner, useApiWakeup } from "./ApiStatusBanner";
import { Logo } from "./Logo";

const HIGHLIGHTS = [
    {
        Icon: SquareKanban,
        title: "A board per project",
        text: "Drag work between columns, with priorities and due dates.",
    },
    {
        Icon: ListChecks,
        title: "Everything assigned to you",
        text: "One list across every project, sorted by what is due.",
    },
    {
        Icon: ShieldCheck,
        title: "Roles that hold",
        text: "Admins, project admins and members, enforced by the API.",
    },
];

/** The frame for every signed-out screen: the form, and the product beside it. */
export function AuthShell({
    title,
    subtitle,
    children,
    footer,
}: {
    title: string;
    subtitle: string;
    children: ReactNode;
    footer: ReactNode;
}) {
    const wakeState = useApiWakeup();

    return (
        <div className="flex min-h-full flex-col bg-canvas text-strong">
            <ApiStatusBanner state={wakeState} />

            <div className="grid flex-1 lg:grid-cols-[1fr_minmax(0,32rem)]">
                <div className="flex items-center justify-center px-4 py-12">
                    <div className="w-full max-w-sm">
                        <div className="mb-10">
                            <Logo />
                        </div>
                        <h1 className="text-display text-strong">{title}</h1>
                        <p className="mt-1 text-sm text-muted">{subtitle}</p>
                        <div className="mt-6">{children}</div>
                        {footer && (
                            <div className="mt-6 text-sm text-muted">
                                {footer}
                            </div>
                        )}
                    </div>
                </div>

                <aside className="relative hidden overflow-hidden bg-indigo-600 px-10 py-12 text-white lg:flex lg:flex-col lg:justify-center">
                    <div
                        aria-hidden="true"
                        className="absolute -top-24 -right-24 size-80 rounded-full bg-white/10 blur-3xl"
                    />
                    <div
                        aria-hidden="true"
                        className="absolute -bottom-32 -left-16 size-96 rounded-full bg-indigo-400/30 blur-3xl"
                    />
                    <div className="relative space-y-8">
                        <p className="text-2xl leading-snug font-semibold tracking-tight">
                            Plan the work, share it with your team, and see
                            where every project stands.
                        </p>
                        <ul className="space-y-5">
                            {HIGHLIGHTS.map(
                                ({ Icon, title: heading, text }) => (
                                    <li key={heading} className="flex gap-3">
                                        <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white/15">
                                            <Icon
                                                className="size-4"
                                                aria-hidden="true"
                                            />
                                        </span>
                                        <span>
                                            <span className="block text-sm font-semibold">
                                                {heading}
                                            </span>
                                            <span className="block text-sm text-indigo-100">
                                                {text}
                                            </span>
                                        </span>
                                    </li>
                                ),
                            )}
                        </ul>
                    </div>
                </aside>
            </div>
        </div>
    );
}
