import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { selectedCampus } from "@/config/campus-server";
import "./globals.css";

// Inter with tabular numbers, decided 2026-09-24 (docs/DESIGN.md section 9).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Mitra", template: "%s · Mitra" },
  description: "A play-money prediction community for personal goals on campus.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const campus = await selectedCampus();
  return (
    <html lang="en" data-campus={campus.key} className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
