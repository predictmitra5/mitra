import type { ReactNode } from "react";

/*
 * Every empty list says what it is waiting for and offers the next step
 * (2026-10-06, docs/DESIGN.md section 13): a short title, one line of what
 * happens next, and the action that gets there. Never bare grey text.
 */
export function EmptyState({ title, children, action, as: Heading = "h2" }: {
  title: string;
  /** One line on what happens next. */
  children: ReactNode;
  /** The next step: usually one .btn link. */
  action?: ReactNode;
  as?: "h1" | "h2";
}) {
  return (
    <section className="empty-state">
      <Heading>{title}</Heading>
      <p>{children}</p>
      {action}
    </section>
  );
}
