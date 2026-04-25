import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import type { PageSummary, SessionUser } from "@ledger/shared";
import { api } from "../lib/api";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { PageHeader } from "./PageHeader";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

export function DraftsPage({
  user,
  spaces
}: {
  user: SessionUser | null;
  spaces: Space[];
}) {
  const [drafts, setDrafts] = useState<PageSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || user.role === "viewer" || user.role === "public") {
      setLoading(false);
      setDrafts([]);
      return;
    }

    api
      .get<{ pages: PageSummary[] }>("/api/pages/drafts")
      .then((response) => setDrafts(response.pages))
      .catch((reason) => setError(reason instanceof Error ? reason.message : "Could not load drafts."))
      .finally(() => setLoading(false));
  }, [user]);

  return (
    <div className="stack-page">
      <PageHeader
        eyebrow="Drafts"
        title="Work in progress"
        description="Draft pages are only visible to people with the right access. Use this space to review and publish content safely."
        actions={user && user.role !== "viewer" && user.role !== "public" ? <Link to="/spaces" className="button-secondary">New draft</Link> : null}
      />

      <section className="content-section">
        {loading ? <p className="muted">Loading drafts...</p> : null}
        {!loading && (!user || user.role === "viewer" || user.role === "public") ? (
          <EmptyState
            title="Drafts require editor access"
            description="Sign in with an editor, admin, or owner account to review draft content."
          />
        ) : null}
        {!loading && error ? (
          <EmptyState title="Could not load drafts" description={error} />
        ) : null}
        {!loading && !error && drafts.length === 0 && user && user.role !== "viewer" && user.role !== "public" ? (
          <EmptyState
            title="No drafts yet"
            description="Create a new draft page from the admin area to start building documentation before publishing."
          />
        ) : null}
        {!loading && drafts.length > 0 ? (
          <div className="document-feed">
            {drafts.map((page) => (
              <Link key={page.id} to={`/page/${page.slug}`} className="document-feed__item">
                <div className="document-feed__icon">
                  <Icon name="document" className="icon icon-sm" />
                </div>
                <div className="document-feed__body">
                  <strong className="document-feed__title">{page.title}</strong>
                  <p className="document-feed__meta">
                    {spaces.find((space) => space.id === page.spaceId)?.name ?? "Collection"} - draft
                  </p>
                  <p className="document-feed__excerpt">{page.excerpt ?? "Draft page without an excerpt yet."}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
