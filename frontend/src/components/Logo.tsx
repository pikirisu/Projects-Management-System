import { Tent } from "lucide-react";

export function Logo() {
    return (
        <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-strong">
            <span className="grid size-7 place-items-center rounded-lg bg-indigo-600 text-white shadow-raised">
                <Tent className="size-4" aria-hidden="true" />
            </span>
            Project Camp
        </span>
    );
}
