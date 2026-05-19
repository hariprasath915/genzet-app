import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AniMind – AI Animation Generator",
  description: "Generate stunning educational animations with AI",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}