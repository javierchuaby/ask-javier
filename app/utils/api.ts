"use client";

import { signIn } from "next-auth/react";

/**
 * Wrapper around fetch that handles 401 (Unauthorized) responses gracefully
 * by redirecting to the sign-in page.
 *
 * @param url - The URL to fetch
 * @param options - Fetch options (method, headers, body, etc.)
 * @returns Promise<Response> - The response if successful
 * @throws Error - If the request fails (non-401 errors)
 */
export async function authenticatedFetch(
  url: string,
  options?: RequestInit,
): Promise<Response> {
  const response = await fetch(url, options);

  // Handle 401 Unauthorized - session expired
  if (response.status === 401) {
    // Redirect to sign-in page with callback URL to return user after sign-in
    const callbackUrl = window.location.pathname + window.location.search;
    await signIn("google", { callbackUrl });

    // Throw error to prevent further execution
    throw new Error("Session expired. Please sign in again.");
  }

  // For other errors, let the caller handle them
  // We don't throw here to allow custom error handling in the calling code
  return response;
}
