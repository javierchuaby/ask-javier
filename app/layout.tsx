import type { Metadata } from "next";
import { Inter, Geist_Mono, Itim } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const itim = Itim({
  weight: "400",
  variable: "--font-itim",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ask Javier",
  description: "AI chat assistant for Aiden",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${inter.variable} ${geistMono.variable} ${itim.variable} antialiased`}
      >
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
