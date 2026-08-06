import { Component } from "react";

/* ============================================================================
 * Last-resort render-error boundary.
 * ----------------------------------------------------------------------------
 * Without this, a render error ANYWHERE white-screens the entire app for a
 * spectator, with no path back except knowing to refresh. This is the only
 * class component in the codebase because error boundaries cannot be written
 * as hooks; do not take it as a pattern.
 *
 * Deliberately styled with the same tokens as the fail-closed configuration
 * card in App.js, and deliberately free of Router/AppState dependencies — if
 * either of those providers is what threw, this must still render.
 * ========================================================================== */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { failed: false };
  }

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error, info) {
    // Console only: there is no telemetry backend, and an anonymous
    // spectator's crash detail belongs in their console, not on their screen.
    console.error("Render failure reached the boundary.", error, info?.componentStack);
  }

  render() {
    if (!this.state.failed) return this.props.children;
    return (
      <main className="min-h-screen bg-background flex items-center justify-center p-6">
        <div data-testid="app-error-boundary" className="max-w-lg bg-card border border-destructive/50 rounded-2xl p-8 text-center">
          <h1 className="font-display uppercase text-heading text-foreground">Something Broke</h1>
          <p className="text-sm text-muted-foreground mt-2">
            The page hit an error it could not recover from. Reloading usually fixes it.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex items-center justify-center rounded-md bg-primary text-ink font-semibold uppercase tracking-wide text-sm px-6 h-11 hover:opacity-90 transition-opacity"
          >
            Reload
          </button>
        </div>
      </main>
    );
  }
}
