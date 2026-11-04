/**
 * Thin logging wrapper. Errors always reach the console so they show up in
 * browser tooling and any attached error reporter. Debug output is dev-only.
 */
type ErrorReporter = (error: unknown, context?: string) => void;

let reporter: ErrorReporter | null = null;

/** Attach an error-reporting service (Sentry, Datadog, etc.) here when one is adopted. */
export function setErrorReporter(fn: ErrorReporter | null) {
  reporter = fn;
}

export const logger = {
  error(context: string, error?: unknown) {
    console.error(`[TableTell] ${context}`, error ?? '');
    try {
      reporter?.(error, context);
    } catch {
      // A failing reporter must never break the app.
    }
  },
  warn(context: string, detail?: unknown) {
    console.warn(`[TableTell] ${context}`, detail ?? '');
  },
  debug(context: string, detail?: unknown) {
    if (import.meta.env.DEV) console.debug(`[TableTell] ${context}`, detail ?? '');
  }
};
