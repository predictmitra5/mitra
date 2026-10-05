import type { Metadata } from "next";
import { Inter, Inter_Tight } from "next/font/google";
import { selectedCampus } from "@/config/campus-server";
import "./globals.css";

// Inter with tabular numbers, decided 2026-09-24 (docs/DESIGN.md section 9).
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const interTight = Inter_Tight({
  variable: "--font-inter-tight",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Mitra", template: "%s · Mitra" },
  description: "A private university prediction community for personal goals.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const campus = await selectedCampus();
  return (
    <html lang="en" data-campus={campus.key} className={`${inter.variable} ${interTight.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
