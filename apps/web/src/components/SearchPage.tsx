import { useState } from "react";
import { Link } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";
import { EmptyState } from "./EmptyState";
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
        description="Search across every page you’re allowed to read. Results respect the same visibility and group rules as the rest of Ledger."
      />

      <section className="panel">
        <SearchBar
          initialQuery={query}
          onSearch={handleSearch}
          placeholder="Search pages, policies, onboarding docs, and runbooks"
        />
      </section>

      <section className="panel">
        <div className="panel__header">
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
          <div className="article-list">
            {results.map((page) => (
              <Link key={page.id} to={`/page/${page.slug}`} className="article-list__item">
                <div className="article-list__meta">
                  <strong>{page.title}</strong>
                  <span>{spaces.find((space) => space.id === page.spaceId)?.name ?? "Collection"}</span>
                </div>
                <p>{page.excerpt ?? "Open this page to read more."}</p>
              </Link>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}
