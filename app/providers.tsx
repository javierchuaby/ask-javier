"use client";

import { ThemeProvider } from "next-themes";
import { SessionProvider } from "next-auth/react";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider
      refetchInterval={0}
      refetchOnWindowFocus={false}
      refetchWhenOffline={false}
    >
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        themes={["light", "dark"]}
      >
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
