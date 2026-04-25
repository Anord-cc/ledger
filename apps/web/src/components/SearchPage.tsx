import { useState } from "react";
import { Link } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";
import { EmptyState } from "./EmptyState";
import { Icon } from "./Icon";
import { PageHeader } from "./PageHeader";
import { SearchBar } from "./SearchBar";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

export function SearchPage({
  spaces,
  results,
  isLoading,
  onSearch
}: {
  spaces: Space[];
  results: PageSummary[];
  isLoading: boolean;
  onSearch: (query: string) => Promise<void>;
}) {
  const [query, setQuery] = useState("");

  async function handleSearch(nextQuery: string) {
    setQuery(nextQuery);
    await onSearch(nextQuery);
  }

  return (
    <div className="stack-page">
      <PageHeader
        eyebrow="Search"
        title="Find answers quickly"
        description="Search across every page you're allowed to read. Results respect the same visibility and group rules as the rest of Ledger."
      />

      <section className="content-section content-section-search">
        <SearchBar
          initialQuery={query}
          onSearch={handleSearch}
          placeholder="Search pages, policies, onboarding docs, and runbooks"
        />
      </section>

      <section className="content-section">
        <div className="section-head">
          <div>
            <p className="eyebrow">Results</p>
            <h3>{query ? `Results for "${query}"` : "Search results"}</h3>
          </div>
        </div>

        {isLoading ? <p className="muted">Searching documentation...</p> : null}

        {!isLoading && query && results.length === 0 ? (
          <EmptyState
            title="No results found"
            description="Try a broader term, a collection name, or a more specific process keyword."
          />
        ) : null}

        {!isLoading && !query ? (
          <EmptyState
            title="Start with a search"
            description="Search titles and document content. Use Cmd/Ctrl + K anywhere in the app for quick search."
          />
        ) : null}

        {!isLoading && results.length > 0 ? (
          <div className="document-feed">
            {results.map((page) => (
              <Link key={page.id} to={`/page/${page.slug}`} className="document-feed__item">
                <div className="document-feed__icon">
                  <Icon name="document" className="icon icon-sm" />
                </div>
                <div className="document-feed__body">
                  <strong className="document-feed__title">{page.title}</strong>
                  <p className="document-feed__meta">
                    {spaces.find((space) => space.id === page.spaceId)?.name ?? "Collection"} - {page.visibility}
                  </p>
                  <p className="document-feed__excerpt">{page.excerpt ?? "Open this page to read more."}</p>
                </div>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
