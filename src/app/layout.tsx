import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { cookies } from "next/headers";
import { selectedCampus } from "@/config/campus-server";
import { THEME_COOKIE, themeFor } from "@/config/theme";
import "./globals.css";

// Geist throughout, decided 2026-10-09 (DECISIONS.md, docs/DESIGN.md section 14),
// replacing Helvetica. next/font downloads it at build time and serves it from
// this site, with a fallback sized to match, so text never jumps as it loads and
// no visitor's browser asks Google for anything.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Mitra", template: "%s · Mitra" },
  description: "Trade on what happens around campus with points. For Ohio State and Illinois students.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const campus = await selectedCampus();
  const theme = themeFor((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-campus={campus.key} data-theme={theme} className={`h-full ${geist.variable}`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
