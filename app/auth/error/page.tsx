"use client";

import Link from "next/link";

export default function AuthError() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-[var(--bg-primary)]">
      <div className="max-w-md w-full mx-4">
        <div className="bg-[var(--message-bubble-assistant-bg)] border border-[var(--stone-300)] rounded-lg p-8 shadow-lg text-center">
          <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-2">
            Access Denied
          </h1>
          <p className="text-sm text-[var(--chat-text-muted)] mb-6">
            Your email address is not authorized to access this application.
          </p>
          <p className="text-xs text-[var(--chat-text-muted)] mb-6">
            Please contact the administrator if you believe this is an error.
          </p>
          <Link
            href="/auth/signin"
            className="inline-block px-4 py-2 bg-[var(--message-bubble-user-bg)] text-[var(--text-primary)] rounded-lg hover:opacity-90 transition-opacity"
          >
            Try Again
          </Link>
        </div>
      </div>
    </div>
  );
}
