import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Cormorant_Garamond, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";

// Ghost voice — the serif that speaks for the departed.
const serif = Cormorant_Garamond({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  style: ["normal", "italic"],
  display: "swap",
});

// Machine voice — the mono that reads the ledger.
const mono = IBM_Plex_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Repo Séance",
  description:
    "Forensics for dead code. Paste an abandoned GitHub repository. Receive its death certificate. Speak with its ghost.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${mono.variable} h-full antialiased`}
    >
      <body className="min-h-full">{children}</body>
    </html>
  );
}
