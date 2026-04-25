import { Link } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";

export function PageSidebar({ pages, title }: { pages: PageSummary[]; title: string }) {
  return (
    <aside className="sidebar-card">
      <div className="sidebar-card__header">
        <h3>{title}</h3>
      </div>
      <nav className="page-tree">
        {pages.map((page) => (
          <Link key={page.id} to={`/page/${page.slug}`} className="page-tree__item">
            <span>{page.title}</span>
            <small>{page.visibility}</small>
          </Link>
        ))}
      </nav>
    </aside>
  );
}

