import { Component, type ErrorInfo, type ReactNode } from "react";
import { Button, Card } from "./ui";

interface State {
    error: Error | null;
}

/**
 * Without a boundary, React unmounts the whole tree when a render throws and
 * the app becomes a blank page. This has to be a class: there is no hook for
 * componentDidCatch.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
    override state: State = { error: null };

    static getDerivedStateFromError(error: Error): State {
        return { error };
    }

    override componentDidCatch(error: Error, info: ErrorInfo) {
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
                        This screen stopped working. Nothing you saved is
                        affected, and reloading usually clears it.
                    </p>

                    {/* Reload, not retry: the state that threw is still there. */}
                    <div className="mt-5">
                        <Button onClick={() => window.location.reload()}>
                            Reload the page
                        </Button>
                    </div>

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
