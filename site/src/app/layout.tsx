import type { Metadata, Viewport } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

// Geist, as in the app (AGENTS.md): downloaded at build time and served from
// this site, with a fallback sized to match so text never jumps.
const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });

export const metadata: Metadata = {
  title: "Mitra · Watch founders build. Call what happens next.",
  description: "Discover early-stage founders through their videos, follow their startups, and see Yes/No markets on the milestones they're chasing.",
  openGraph: {
    title: "Mitra",
    description: "Watch founders build. Call what happens next.",
    type: "website",
  },
};

// The page runs edge to edge on phones (under a notch held sideways, or the
// system bars where the browser allows it); globals.css pads the menu, the
// content and the footer's small print back out with the safe-area insets.
export const viewport: Viewport = { themeColor: "#0b0b0c", viewportFit: "cover" };

// Runs before the first paint: whether this visitor gets the full motion. With
// it, what will animate in starts hidden instead of flashing; without it (or
// without JavaScript) the page is simply shown.
const MOTION = `(function(){try{document.documentElement.dataset.motion=matchMedia("(prefers-reduced-motion: reduce)").matches?"reduce":"full"}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={geist.variable} data-motion="reduce" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: MOTION }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
