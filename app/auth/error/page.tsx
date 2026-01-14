"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

// Prevent static generation - useSearchParams requires runtime URL access
export const dynamic = 'force-dynamic';

const errorMessages: Record<string, { title: string; description: string }> = {
  AccessDenied: {
    title: "Access Denied",
    description: "You are not authorized to access this application.",
  },
  Configuration: {
    title: "Configuration Error",
    description: "There's a problem with the server configuration.",
  },
  OAuthSignin: {
    title: "Sign In Error",
    description: "Could not start sign in process. Please try again.",
  },
  OAuthCallback: {
    title: "Callback Error",
    description: "Could not complete sign in process. Please try again.",
  },
  OAuthAccountNotLinked: {
    title: "Account Not Linked",
    description: "This email is already associated with another account.",
  },
  Default: {
    title: "Authentication Error",
    description: "An unexpected error occurred during authentication.",
  },
};

function ErrorContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error") || "Default";
  const { title, description } = errorMessages[error] || errorMessages.Default;

  return (
    <div className="w-full max-w-[500px] mx-4">
      <div className="bg-white dark:bg-[#212121] border border-gray-200 dark:border-[#303030] rounded-3xl p-10 shadow-xl shadow-black/10 dark:shadow-xl dark:shadow-black/20 text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-[#ffffff] mb-3 -mt-1">
          {title}
        </h1>
        <p className="text-base text-gray-600 dark:text-[#ffffff]/70 mb-2">
          {description}
        </p>
        <p className="text-sm text-gray-600 dark:text-[#ffffff]/70 mb-5">
          Please contact the administrator if you believe this is an error.
        </p>
        <Link
          href="/auth/signin"
          className="inline-flex items-center justify-center gap-3 px-6 py-3 
          bg-white dark:bg-[#303030] 
          border border-gray-300 dark:border-[#303030] 
          rounded-full 
          hover:bg-gray-50 dark:hover:bg-[#212121] 
          hover:border-gray-400 dark:hover:border-[#ffffff]/20 
          shadow-lg shadow-black/10 hover:shadow-xl hover:shadow-black/20 dark:shadow-lg dark:shadow-black/30 dark:hover:shadow-xl dark:hover:shadow-black/40
          transition-all duration-200
          text-gray-700 dark:text-[#ffffff] 
          font-medium text-sm
          hover:scale-[1.02] active:scale-[0.98] -mb-3"
        >
          Try Again
        </Link>
      </div>
    </div>
  );
}

export default function AuthError() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-50 dark:from-[#181818] dark:via-[#181818] dark:to-[#212121]">
      <Suspense fallback={<div className="w-full max-w-[500px] mx-4 text-center text-gray-600 dark:text-[#ffffff]/70">Loading...</div>}>
        <ErrorContent />
      </Suspense>
    </div>
  );
}
