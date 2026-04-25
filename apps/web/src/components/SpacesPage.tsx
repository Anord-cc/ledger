import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { PageHeader } from "./PageHeader";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

export function SpacesPage({
  spaces,
  pagesBySpace
}: {
  spaces: Space[];
  pagesBySpace: Record<string, PageSummary[]>;
}) {
  const [tab, setTab] = useState<"updated" | "public" | "internal">("updated");
  const collections = useMemo(
    () =>
      spaces
        .map((space) => ({
          ...space,
          count: (pagesBySpace[space.key] ?? []).length
        }))
        .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)),
    [pagesBySpace, spaces]
  );
  const allPages = useMemo(
    () =>
      Object.values(pagesBySpace)
        .flat()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [pagesBySpace]
  );

  const visiblePages = allPages.filter((page) => {
    if (tab === "public") {
      return page.visibility === "public";
    }

    if (tab === "internal") {
      return page.visibility !== "public";
    }

    return true;
  });

  return (
    <div className="home-page">
      <PageHeader
        eyebrow="Knowledge base"
        title="Home"
        description="Open the latest docs, move between collections quickly, and keep the knowledge base feeling lightweight instead of buried in admin screens."
      />

      {allPages.length === 0 ? (
        <section className="panel panel-muted">
          <EmptyState
            title="No documents published yet"
            description="Create your first pages and they will appear here as the workspace home feed."
          />
        </section>
      ) : (
        <>
          <div className="home-tabs" role="tablist" aria-label="Home filters">
            <button type="button" className={`home-tab${tab === "updated" ? " is-active" : ""}`} onClick={() => setTab("updated")}>
              Recently updated
            </button>
            <button type="button" className={`home-tab${tab === "public" ? " is-active" : ""}`} onClick={() => setTab("public")}>
              Public docs
            </button>
            <button type="button" className={`home-tab${tab === "internal" ? " is-active" : ""}`} onClick={() => setTab("internal")}>
              Internal docs
            </button>
          </div>

          <div className="home-content-grid">
            <section className="document-feed">
              {visiblePages.map((page) => {
                const space = spaces.find((entry) => entry.id === page.spaceId);
                return (
                  <Link key={page.id} to={`/page/${page.slug}`} className="document-feed__item">
                    <div className="document-feed__icon">
                      <Icon name="document" className="icon icon-sm" />
                    </div>
                    <div className="document-feed__body">
                      <strong className="document-feed__title">{page.title}</strong>
                      <p className="document-feed__meta">
                        Updated {new Date(page.updatedAt).toLocaleDateString()} in {space?.name ?? "Collection"} - {page.visibility}
                      </p>
                    </div>
                  </Link>
                );
              })}
            </section>

            <aside className="home-side-column">
              <div className="section-head section-head--compact">
                <div>
                  <p className="eyebrow">Quick access</p>
                  <h3>Collections</h3>
                </div>
              </div>
              <div className="collection-list">
                {collections.map((space) => (
                  <Link key={space.id} to={`/space/${space.key}`} className="collection-list__item">
                    <div className="collection-list__body">
                      <strong>{space.name}</strong>
                      <p>{space.count} documents</p>
                    </div>
                    <span className={`badge badge-${space.visibility}`}>{space.visibility}</span>
                  </Link>
                ))}
              </div>
            </aside>
          </div>
        </>
      )}
    </div>
  );
}
