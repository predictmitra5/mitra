import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

// Inter with tabular numbers, decided 2026-09-24 (docs/DESIGN.md section 9).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Mitra", template: "%s · Mitra" },
  description: "Bet on literally anything your friends are going for, with play money. Ohio State early access.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
