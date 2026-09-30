import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card } from "./ui";

/*
 * React unmounts the whole tree when a render throws and nothing catches it,
 * so without a boundary any single bad field -- a task whose project went
 * missing, an array the API stopped sending -- replaces the entire app with a
 * blank white page. No message, no navigation, nothing to report. The person is
 * left unable to tell a crash from a slow network.
 *
 * This has to be a class: there is no hook equivalent of componentDidCatch, and
 * a boundary cannot catch errors thrown by its own children's event handlers or
 * by async code, only during render, in lifecycles, and in constructors.
 */

interface Props {
    children: ReactNode;
}

interface State {
    error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
        // The only record that survives the unmount. Without it the stack is
        // gone by the time anyone opens the console.
        console.error("[ui] render failed:", error, info.componentStack);
    }

    override render() {
        const { error } = this.state;
        if (!error) return this.props.children;

        return (
            <div className="grid min-h-full place-items-center bg-canvas px-4 py-12">
                <Card className="w-full max-w-md p-6 text-strong">
                    <h1 className="text-title text-strong">
                        Something went wrong
                    </h1>
                    <p className="mt-2 text-sm text-muted">
                        This screen stopped working. Nothing you had saved is
                        affected — reloading usually clears it.
                    </p>

                    <div className="mt-5">
                        {/*
                         * Reload rather than a retry button. The tree is torn
                         * down and whatever state produced the error is still
                         * there, so re-rendering it would fail again instantly
                         * and look like the button does nothing.
                         */}
                        <Button onClick={() => window.location.reload()}>
                            Reload the page
                        </Button>
                    </div>

                    {/*
                     * Collapsed, not hidden. Nobody needs to read this, but the
                     * one line it holds is the difference between a useful bug
                     * report and "it broke".
                     */}
                    <details className="mt-5 text-xs text-muted">
                        <summary className="cursor-pointer select-none">
                            Technical details
                        </summary>
                        <p className="mt-2 font-mono break-words">
                            {error.message || String(error)}
                        </p>
                    </details>
                </Card>
            </div>
        );
    }
}
