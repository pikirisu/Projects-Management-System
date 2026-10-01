import {
    useEffect,
    useRef,
    useState,
    type ReactNode,
    type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Button } from "./Button";
import { cx } from "./cx";

/**
 * What every overlay needs while open: Escape closes it, the page behind stops
 * scrolling, focus moves into it and returns to where it was on close.
 *
 * `onClose` is read through a ref so a parent re-render, which hands over a new
 * function, does not re-run this and steal focus mid-typing.
 */
function useOverlay(
    open: boolean,
    onClose: () => void,
    panelRef: RefObject<HTMLElement | null>,
) {
    const onCloseRef = useRef(onClose);
    useEffect(() => {
        onCloseRef.current = onClose;
    });

    useEffect(() => {
        if (!open) return;

        const returnFocusTo = document.activeElement as HTMLElement | null;
        const onKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape") onCloseRef.current();
        };
        const overflow = document.body.style.overflow;

        document.addEventListener("keydown", onKeyDown);
        document.body.style.overflow = "hidden";
        panelRef.current?.focus();

        return () => {
            document.removeEventListener("keydown", onKeyDown);
            document.body.style.overflow = overflow;
            returnFocusTo?.focus?.();
        };
    }, [open, panelRef]);
}

function Backdrop({ onClick }: { onClick: () => void }) {
    return (
        <div
            aria-hidden="true"
            onClick={onClick}
            className="absolute inset-0 bg-neutral-950/50 backdrop-blur-[2px]"
        />
    );
}

function CloseButton({
    onClick,
    label,
}: {
    onClick: () => void;
    label: string;
}) {
    return (
        <Button
            variant="ghost"
            size="icon"
            onClick={onClick}
            aria-label={label}
        >
            <X className="size-4" />
        </Button>
    );
}

/** A right-hand panel for a record's detail, e.g. a task. */
export function SlideOver({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: ReactNode;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    useOverlay(open, onClose, panelRef);
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex justify-end">
            <Backdrop onClick={onClose} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                tabIndex={-1}
                className="relative flex h-full w-full max-w-xl flex-col bg-surface shadow-overlay outline-none"
            >
                <div className="flex items-start justify-between gap-4 border-b border-hairline px-5 py-4">
                    <div className="min-w-0 flex-1">{title}</div>
                    <CloseButton onClick={onClose} label="Close panel" />
                </div>
                <div className="flex-1 overflow-y-auto px-5 py-5">
                    {children}
                </div>
            </div>
        </div>,
        document.body,
    );
}

/** A centred modal for a short form, e.g. creating a project. */
export function Dialog({
    open,
    onClose,
    title,
    children,
}: {
    open: boolean;
    onClose: () => void;
    title: string;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    useOverlay(open, onClose, panelRef);
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto p-4">
            <Backdrop onClick={onClose} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={title}
                tabIndex={-1}
                className="relative w-full max-w-lg rounded-xl border border-hairline bg-surface shadow-overlay outline-none"
            >
                <div className="flex items-center justify-between gap-4 border-b border-hairline px-5 py-3.5">
                    <h2 className="text-heading text-strong">{title}</h2>
                    <CloseButton onClick={onClose} label="Close dialog" />
                </div>
                <div className="px-5 py-5">{children}</div>
            </div>
        </div>,
        document.body,
    );
}

/** A left-hand drawer: the sidebar's home on a narrow screen. */
export function Drawer({
    open,
    onClose,
    label,
    children,
}: {
    open: boolean;
    onClose: () => void;
    label: string;
    children: ReactNode;
}) {
    const panelRef = useRef<HTMLDivElement>(null);
    useOverlay(open, onClose, panelRef);
    if (!open) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex lg:hidden">
            <Backdrop onClick={onClose} />
            <div
                ref={panelRef}
                role="dialog"
                aria-modal="true"
                aria-label={label}
                tabIndex={-1}
                className="relative flex h-full w-72 max-w-[85%] flex-col bg-surface shadow-overlay outline-none"
            >
                {children}
            </div>
        </div>,
        document.body,
    );
}

/**
 * Two-step destructive action. Not window.confirm: that blocks the page,
 * cannot be styled, and some embedded browsers suppress it outright.
 */
export function ConfirmButton({
    onConfirm,
    loading = false,
    children = "Delete",
    confirmLabel = "Confirm",
    /**
     * Names the button for assistive tech where it repeats, e.g. "Remove
     * attachment spec.pdf" instead of a row of identical "Remove"s.
     */
    describedAs,
    size = "sm",
    className,
}: {
    onConfirm: () => void;
    loading?: boolean;
    children?: ReactNode;
    confirmLabel?: string;
    describedAs?: string;
    size?: "sm" | "md";
    className?: string;
}) {
    const [armed, setArmed] = useState(false);

    // Disarms itself, so a half-pressed delete never lingers.
    useEffect(() => {
        if (!armed) return;
        const timer = window.setTimeout(() => setArmed(false), 4000);
        return () => window.clearTimeout(timer);
    }, [armed]);

    if (!armed) {
        return (
            <Button
                variant="ghost"
                size={size}
                aria-label={describedAs}
                className={cx("text-red-600 dark:text-red-400", className)}
                onClick={() => setArmed(true)}
            >
                {children}
            </Button>
        );
    }

    return (
        <span className="inline-flex items-center gap-1">
            <Button
                variant="danger"
                size={size}
                loading={loading}
                aria-label={describedAs && `${confirmLabel}: ${describedAs}`}
                onClick={() => {
                    setArmed(false);
                    onConfirm();
                }}
            >
                {confirmLabel}
            </Button>
            <Button variant="ghost" size={size} onClick={() => setArmed(false)}>
                Cancel
            </Button>
        </span>
    );
}
