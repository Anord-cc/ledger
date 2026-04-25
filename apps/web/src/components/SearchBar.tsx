import { FormEvent, useState } from "react";
import { Icon } from "./Icon";

export function SearchBar({
  initialQuery = "",
  onSearch,
  placeholder = "Search documentation",
  compact = false
}: {
  initialQuery?: string;
  onSearch: (query: string) => void;
  placeholder?: string;
  compact?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <form className={`search-bar${compact ? " search-bar-compact" : ""}`} onSubmit={handleSubmit}>
      <span className="search-bar__icon">
        <Icon name="search" className="icon" />
      </span>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
      />
      <button type="submit" className="search-bar__submit">{compact ? "Go" : "Search"}</button>
    </form>
  );
}
