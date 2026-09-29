import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ErrorBoundary } from "./ErrorBoundary";

// The `never` return is what makes this usable as a component: a function that
// only throws is inferred as returning void, which is not a ReactNode.
function Boom({
    message = "task.project is undefined",
}: {
    message?: string;
}): never {
    throw new Error(message);
}

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
    /*
     * React logs every caught error itself, on top of the boundary's own
     * componentDidCatch. Left alone that is a wall of red in an otherwise
     * passing run, which trains everyone to ignore the output.
     */
    consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
    consoleError.mockRestore();
});

describe("ErrorBoundary", () => {
    it("renders its children when nothing throws", () => {
        render(
            <ErrorBoundary>
                <p>the app</p>
            </ErrorBoundary>,
        );

        expect(screen.getByText("the app")).toBeInTheDocument();
    });

    it("is the only thing between a throw and a blank page", () => {
        // The negative control: React has no default for this. Unhandled, the
        // throw escapes render and takes the whole tree with it.
        expect(() => render(<Boom />)).toThrow("task.project is undefined");
    });

    it("shows a recoverable screen instead of a blank page", () => {
        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );

        /*
         * Without a boundary React unmounts the whole tree, so the alternative
         * to this screen is not a worse message -- it is an empty white page
         * with no way to tell a crash from a slow network.
         */
        expect(
            screen.getByRole("heading", { name: "Something went wrong" }),
        ).toBeInTheDocument();
        expect(
            screen.getByRole("button", { name: "Reload the page" }),
        ).toBeInTheDocument();
    });

    it("keeps the message where a bug report can reach it", async () => {
        render(
            <ErrorBoundary>
                <Boom message="tasks.map is not a function" />
            </ErrorBoundary>,
        );

        const user = userEvent.setup();
        await user.click(screen.getByText("Technical details"));

        expect(
            screen.getByText("tasks.map is not a function"),
        ).toBeInTheDocument();
        // And it is on the console, which is the only copy that survives.
        expect(consoleError).toHaveBeenCalled();
    });

    it("reloads rather than re-rendering the tree that failed", async () => {
        const reload = vi.fn();
        // jsdom's location.reload is not configurable, so replace the accessor.
        const original = window.location;
        Object.defineProperty(window, "location", {
            configurable: true,
            value: { ...original, reload },
        });

        render(
            <ErrorBoundary>
                <Boom />
            </ErrorBoundary>,
        );

        const user = userEvent.setup();
        await user.click(
            screen.getByRole("button", { name: "Reload the page" }),
        );

        /*
         * A "try again" that re-renders would hit the same error immediately
         * and look like a dead button, because the state that produced it is
         * still there.
         */
        expect(reload).toHaveBeenCalledTimes(1);

        Object.defineProperty(window, "location", {
            configurable: true,
            value: original,
        });
    });
});
