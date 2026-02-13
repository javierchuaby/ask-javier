/**
 * Next.js instrumentation hook - runs once when the server starts.
 * Importing env here triggers validation at startup; if any required
 * env var is missing, the server will fail fast with a clear error.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env");
  }
}
