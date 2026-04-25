import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";
import { Icon } from "./Icon";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

export function CommandSearch({
  open,
  onClose,
  onSearch,
  spaces,
  results,
  isLoading
}: {
  open: boolean;
  onClose: () => void;
  onSearch: (query: string) => void;
  spaces: Space[];
  results: PageSummary[];
  isLoading: boolean;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }
    inputRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) {
      return;
    }

    const timeout = window.setTimeout(() => {
      onSearch(query);
    }, 180);

    return () => window.clearTimeout(timeout);
  }, [open, onSearch, query]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    if (open) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose, open]);

  const grouped = results.reduce<Record<string, PageSummary[]>>((acc, result) => {
    acc[result.spaceId] = acc[result.spaceId] ?? [];
    acc[result.spaceId].push(result);
    return acc;
  }, {});

  const spaceNameFor = (spaceId: string) => spaces.find((space) => space.id === spaceId)?.name ?? "Collection";

  return (
    <>
      <div className={`command-palette__overlay${open ? " is-open" : ""}`} onClick={onClose} />
      <section className={`command-palette${open ? " is-open" : ""}`} aria-hidden={!open}>
        <div className="command-palette__input">
          <Icon name="search" className="icon" />
          <input
            ref={inputRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search docs, pages, and answers"
            aria-label="Search"
          />
          <button type="button" className="button-ghost" onClick={onClose}>
            Esc
          </button>
        </div>

        <div className="command-palette__results">
          {isLoading ? <p className="muted">Searching...</p> : null}
          {!isLoading && query.trim() && results.length === 0 ? (
            <p className="muted">No results found.</p>
          ) : null}
          {!isLoading && !query.trim() ? (
            <p className="muted">Search by title or article content. Try a page name, keyword, or process.</p>
          ) : null}

          {Object.entries(grouped).map(([spaceId, items]) => (
            <div key={spaceId} className="search-group">
              <div className="search-group__label">{spaceNameFor(spaceId)}</div>
              {items.map((result) => (
                <Link key={result.id} to={`/page/${result.slug}`} className="search-result" onClick={onClose}>
                  <div className="search-result__icon">
                    <Icon name="document" className="icon icon-sm" />
                  </div>
                  <div className="search-result__body">
                    <strong>{result.title}</strong>
                    <p>{result.excerpt ?? "Open this article to read more."}</p>
                    <span>{spaceNameFor(spaceId)} / {result.slug}</span>
                  </div>
                </Link>
              ))}
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
