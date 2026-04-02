import type { Metadata } from "next";
import { Lora, Noto_Sans_Devanagari, Space_Grotesk } from "next/font/google";

import "./globals.css";

const displayFont = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["500", "700"],
});

const bodyFont = Lora({
  subsets: ["latin"],
  variable: "--font-body",
  weight: ["400", "500", "600"],
});

const hindiFont = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-hindi",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "PDF Test Studio",
  description: "Parse question and answer PDFs into interactive tests backed by Convex.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={`${displayFont.variable} ${bodyFont.variable} ${hindiFont.variable}`}>{children}</body>
    </html>
  );
}
