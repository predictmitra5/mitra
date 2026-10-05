import type { Metadata } from "next";
import { cookies } from "next/headers";
import { selectedCampus } from "@/config/campus-server";
import { THEME_COOKIE, themeFor } from "@/config/theme";
import "./globals.css";

// Helvetica throughout, decided 2026-10-05: the font stack lives in globals.css
// (--font-sans), so nothing is downloaded.

export const metadata: Metadata = {
  title: { default: "Mitra", template: "%s · Mitra" },
  description: "Bet on your classmates’ goals with points. For Ohio State and Illinois students.",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const campus = await selectedCampus();
  const theme = themeFor((await cookies()).get(THEME_COOKIE)?.value);
  return (
    <html lang="en" data-campus={campus.key} data-theme={theme} className="h-full">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
