export function SidebarSkeleton() {
  return (
    <aside className="sidebar">
      <div className="skeleton skeleton-title" />
      <div className="skeleton-group">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
        <div className="skeleton skeleton-line" />
      </div>
      <div className="skeleton-group">
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line" />
        <div className="skeleton skeleton-line short" />
      </div>
    </aside>
  );
}

export function ContentSkeleton() {
  return (
    <section className="doc-card">
      <div className="doc-card__header">
        <div className="skeleton skeleton-chip" />
        <div className="skeleton skeleton-chip short" />
      </div>
      <div className="skeleton skeleton-heading" />
      <div className="skeleton skeleton-meta" />
      <div className="skeleton-block">
        <div className="skeleton skeleton-paragraph" />
        <div className="skeleton skeleton-paragraph" />
        <div className="skeleton skeleton-paragraph short" />
      </div>
      <div className="skeleton-block">
        <div className="skeleton skeleton-subheading" />
        <div className="skeleton skeleton-paragraph" />
        <div className="skeleton skeleton-paragraph short" />
      </div>
    </section>
  );
}

