/*
 * The Mitra logo (2026-10-19): the owner's wordmark and lotus, cut from the
 * Mitra.svg they supplied into public/brand/mitra-logo.svg (the lockup) and
 * mitra-lotus.svg (the lotus alone). Both are drawn through a CSS mask, so they
 * take the text colour of where they sit (white on black, black on white) and
 * the browser caches one small file instead of every page carrying the path.
 */

export function Logo({ className, title = "Mitra" }: { className?: string; title?: string }) {
  return <span className={`logo-mark logo-lockup${className ? ` ${className}` : ""}`} role="img" aria-label={title} />;
}

/** The lotus alone, for icons and small spaces. Decorative unless titled. */
export function LogoSymbol({ className, title }: { className?: string; title?: string }) {
  return (
    <span className={`logo-mark logo-lotus${className ? ` ${className}` : ""}`}
      role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true} />
  );
}
