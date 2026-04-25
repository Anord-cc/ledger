import type { PageSummary, SessionUser } from "@ledger/shared";
import { canReadVisibility } from "@ledger/shared";
import { pool } from "../db/pool.js";
import { getSearchCandidates } from "./pages.js";

export function matchesSearchQuery(query: string, title: string, bodyMarkdown: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) {
    return false;
  }

  return (
    title.toLowerCase().includes(normalizedQuery) ||
    bodyMarkdown.toLowerCase().includes(normalizedQuery)
  );
}

export async function searchPages(query: string, user: SessionUser | null): Promise<PageSummary[]> {
  const candidates = await getSearchCandidates();
  const visible: PageSummary[] = [];

  for (const row of candidates) {
    if (!matchesSearchQuery(query, row.title, row.body_markdown)) {
      continue;
    }

    const permissions = await pool.query(
      `SELECT role_key, group_id FROM page_permissions WHERE page_id = $1`,
      [row.id]
    );

    const roleKeys = permissions.rows.map((permission) => permission.role_key).filter(Boolean);
    const groupIds = permissions.rows.map((permission) => permission.group_id).filter(Boolean);

    if (!canReadVisibility(user, row.visibility, roleKeys, groupIds)) {
      continue;
    }

    const tags = await pool.query(
      `SELECT t.name FROM page_tags pt JOIN tags t ON t.id = pt.tag_id WHERE pt.page_id = $1`,
      [row.id]
    );

    visible.push({
      id: row.id,
      spaceId: row.space_id,
      title: row.title,
      slug: row.slug,
      excerpt: row.excerpt,
      visibility: row.visibility,
      state: row.state,
      isPublic: row.is_public,
      parentPageId: row.parent_page_id,
      tags: tags.rows.map((tag) => tag.name),
      updatedAt: row.updated_at.toISOString()
    });
  }

  return visible.slice(0, 20);
}

export async function recordSearch(query: string, userId: string | null, results: PageSummary[]) {
  const search = await pool.query(
    `
      INSERT INTO searches (user_id, query, visible_scope, results_count)
      VALUES ($1, $2, $3, $4)
      RETURNING id
    `,
    [userId, query, userId ? "authenticated" : "public", results.length]
  );

  for (const [index, result] of results.entries()) {
    await pool.query(
      `INSERT INTO search_results (search_id, page_id, position) VALUES ($1, $2, $3)`,
      [search.rows[0].id, result.id, index + 1]
    );
  }

  return search.rows[0].id as string;
}
