import type { ReactNode } from "react";

export function EmptyState({
  eyebrow,
  title,
  description,
  action
}: {
  eyebrow?: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section className="empty-state">
      {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
      <h2>{title}</h2>
      <p className="muted">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </section>
  );
}
