/*
 * The owner's wordmark and lotus (the app's public/brand files, cut from
 * Mitra.svg on 2026-10-19), drawn through a CSS mask so they take the colour
 * of wherever they sit.
 */

export function Logo({ className }: { className?: string }) {
  return <span className={`logo-mark logo-lockup${className ? ` ${className}` : ""}`} role="img" aria-label="Mitra" />;
}

export function LotusMark({ className }: { className?: string }) {
  return <span className={`logo-mark logo-lotus${className ? ` ${className}` : ""}`} aria-hidden="true" />;
}
