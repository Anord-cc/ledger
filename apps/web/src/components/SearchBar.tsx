import { FormEvent, useState } from "react";

export function SearchBar({
  initialQuery = "",
  onSearch
}: {
  initialQuery?: string;
  onSearch: (query: string) => void;
}) {
  const [query, setQuery] = useState(initialQuery);

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    onSearch(query);
  }

  return (
    <form className="search-bar" onSubmit={handleSubmit}>
      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search trusted answers"
      />
      <button type="submit">Search</button>
    </form>
  );
}

