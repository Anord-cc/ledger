import { Link } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";
import { EmptyState } from "./EmptyState";
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
  return (
    <div className="stack-page">
      <PageHeader
        eyebrow="Spaces"
        title="Browse knowledge by space"
        description="Each space organizes a collection of public or internal documentation. Use spaces to separate teams, products, or domains."
      />

      {spaces.length === 0 ? (
        <section className="panel">
          <EmptyState
            title="No spaces available"
            description="Create a space from the admin area before publishing documents."
          />
        </section>
      ) : (
        <section className="collection-cards">
          {spaces.map((space) => (
            <Link key={space.id} to={`/space/${space.key}`} className="collection-card">
              <div className="collection-card__icon" />
              <div>
                <strong>{space.name}</strong>
                <p>{space.visibility} visibility</p>
              </div>
              <span>{(pagesBySpace[space.key] ?? []).length} docs</span>
            </Link>
          ))}
        </section>
      )}
    </div>
  );
}
