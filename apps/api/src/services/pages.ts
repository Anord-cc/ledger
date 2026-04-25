import type { PageDetail, PageSummary, PageUpsertInput, RoleKey, SessionUser } from "@ledger/shared";
import { canReadVisibility } from "@ledger/shared";
import { pool } from "../db/pool.js";
import { renderMarkdown } from "../utils/markdown.js";
import { slugify } from "../utils/slug.js";

type PageRecord = {
  id: string;
  space_id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  visibility: "public" | "internal" | "restricted";
  state: "draft" | "published";
  is_public: boolean;
  parent_page_id: string | null;
  updated_at: Date;
  revision_id: string;
  body_markdown: string;
  author_name: string;
};

type SourceRow = {
  provider: "markdown_import" | "github" | "google_docs";
  source_url: string | null;
  source_title: string | null;
  source_branch: string | null;
  source_path: string | null;
  source_document_id: string | null;
  imported_at: Date;
  imported_by: string | null;
  last_synced_at: Date | null;
};

async function getPagePermissions(pageId: string) {
  const permissions = await pool.query(
    `SELECT role_key, group_id FROM page_permissions WHERE page_id = $1`,
    [pageId]
  );

  return {
    roleKeys: permissions.rows.map((row) => row.role_key).filter(Boolean) as RoleKey[],
    groupIds: permissions.rows.map((row) => row.group_id).filter(Boolean) as string[]
  };
}

async function getPageTags(pageId: string): Promise<string[]> {
  const tags = await pool.query(
    `
      SELECT t.name
      FROM page_tags pt
      JOIN tags t ON t.id = pt.tag_id
      WHERE pt.page_id = $1
      ORDER BY t.name ASC
    `,
    [pageId]
  );

  return tags.rows.map((row) => row.name);
}

async function getPageSource(pageId: string) {
  const source = await pool.query(
    `
      SELECT
        eps.provider,
        eps.source_url,
        eps.source_title,
        eps.source_branch,
        eps.source_path,
        eps.source_document_id,
        eps.imported_at,
        COALESCE(u.display_name, 'Unknown') AS imported_by,
        eps.last_synced_at
      FROM external_page_sources eps
      LEFT JOIN users u ON u.id = eps.imported_by_user_id
      WHERE eps.page_id = $1
    `,
    [pageId]
  );

  if (!source.rowCount) {
    return null;
  }

  const row = source.rows[0] as SourceRow;
  return {
    provider: row.provider,
    sourceUrl: row.source_url,
    sourceTitle: row.source_title,
    sourceBranch: row.source_branch,
    sourcePath: row.source_path,
    sourceDocumentId: row.source_document_id,
    importedAt: row.imported_at.toISOString(),
    importedBy: row.imported_by,
    lastSyncedAt: row.last_synced_at?.toISOString() ?? null
  };
}

function toSummary(row: PageRecord, tags: string[]): PageSummary {
  return {
    id: row.id,
    spaceId: row.space_id,
    title: row.title,
    slug: row.slug,
    excerpt: row.excerpt,
    visibility: row.visibility,
    state: row.state,
    isPublic: row.is_public,
    parentPageId: row.parent_page_id,
    tags,
    updatedAt: row.updated_at.toISOString()
  };
}

async function upsertTags(pageId: string, tagNames: string[] = []) {
  await pool.query("DELETE FROM page_tags WHERE page_id = $1", [pageId]);

  for (const tagName of tagNames) {
    const normalized = tagName.trim().toLowerCase();
    if (!normalized) continue;

    const tag = await pool.query(
      `
        INSERT INTO tags (name)
        VALUES ($1)
        ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
        RETURNING id
      `,
      [normalized]
    );

    await pool.query(
      `INSERT INTO page_tags (page_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [pageId, tag.rows[0].id]
    );
  }
}

async function upsertPermissions(
  pageId: string,
  allowedRoleKeys: RoleKey[] = [],
  allowedGroupIds: string[] = []
) {
  await pool.query("DELETE FROM page_permissions WHERE page_id = $1", [pageId]);

  for (const roleKey of allowedRoleKeys) {
    await pool.query(`INSERT INTO page_permissions (page_id, role_key) VALUES ($1, $2)`, [
      pageId,
      roleKey
    ]);
  }

  for (const groupId of allowedGroupIds) {
    await pool.query(`INSERT INTO page_permissions (page_id, group_id) VALUES ($1, $2)`, [
      pageId,
      groupId
    ]);
  }
}

export async function listSpaces(user: SessionUser | null) {
  const result = await pool.query(`SELECT id, name, key, visibility FROM spaces ORDER BY name ASC`);
  return result.rows.filter((row) => canReadVisibility(user, row.visibility, [], []));
}

export async function listPagesForSpace(spaceKey: string, user: SessionUser | null) {
  const result = await pool.query(
    `
      SELECT
        p.id, p.space_id, p.title, p.slug, p.excerpt, p.visibility, p.state, p.is_public,
        p.parent_page_id, p.updated_at, pr.id AS revision_id, pr.body_markdown,
        COALESCE(u.display_name, 'Unknown') AS author_name
      FROM pages p
      JOIN spaces s ON s.id = p.space_id
      JOIN page_revisions pr ON pr.id = p.current_revision_id
      LEFT JOIN users u ON u.id = pr.edited_by_user_id
      WHERE s.key = $1 AND p.state = 'published'
      ORDER BY p.title ASC
    `,
    [spaceKey]
  );

  const pages: PageSummary[] = [];
  for (const row of result.rows as PageRecord[]) {
    const permissions = await getPagePermissions(row.id);
    if (!canReadVisibility(user, row.visibility, permissions.roleKeys, permissions.groupIds)) {
      continue;
    }
    pages.push(toSummary(row, await getPageTags(row.id)));
  }

  return pages;
}

export async function listDraftPages(user: SessionUser | null) {
  if (!user) {
    return [];
  }

  const result = await pool.query(
    `
      SELECT
        p.id, p.space_id, p.title, p.slug, p.excerpt, p.visibility, p.state, p.is_public,
        p.parent_page_id, p.updated_at, pr.id AS revision_id, pr.body_markdown,
        COALESCE(u.display_name, 'Unknown') AS author_name
      FROM pages p
      JOIN page_revisions pr ON pr.id = p.current_revision_id
      LEFT JOIN users u ON u.id = pr.edited_by_user_id
      WHERE p.state = 'draft'
      ORDER BY p.updated_at DESC
    `
  );

  const drafts: PageSummary[] = [];
  for (const row of result.rows as PageRecord[]) {
    const permissions = await getPagePermissions(row.id);
    if (!canReadVisibility(user, row.visibility, permissions.roleKeys, permissions.groupIds)) {
      continue;
    }
    drafts.push(toSummary(row, await getPageTags(row.id)));
  }

  return drafts;
}

export async function getPageBySlug(slug: string, user: SessionUser | null): Promise<PageDetail | null> {
  const result = await pool.query(
    `
      SELECT
        p.id, p.space_id, p.title, p.slug, p.excerpt, p.visibility, p.state, p.is_public,
        p.parent_page_id, p.updated_at, pr.id AS revision_id, pr.body_markdown,
        COALESCE(u.display_name, 'Unknown') AS author_name
      FROM pages p
      JOIN page_revisions pr ON pr.id = p.current_revision_id
      LEFT JOIN users u ON u.id = pr.edited_by_user_id
      WHERE p.slug = $1
    `,
    [slug]
  );

  if (!result.rowCount) {
    return null;
  }

  const row = result.rows[0] as PageRecord;
  const permissions = await getPagePermissions(row.id);
  if (!canReadVisibility(user, row.visibility, permissions.roleKeys, permissions.groupIds)) {
    return null;
  }

  const tags = await getPageTags(row.id);
  const rendered = renderMarkdown(row.body_markdown);

  return {
    ...toSummary(row, tags),
    bodyMarkdown: row.body_markdown,
    bodyHtml: rendered.bodyHtml,
    toc: rendered.toc,
    revisionId: row.revision_id,
    authorName: row.author_name,
    source: await getPageSource(row.id)
  };
}

export async function createOrUpdatePage(existingPageId: string | null, input: PageUpsertInput, actorUserId: string) {
  const rendered = renderMarkdown(input.bodyMarkdown);
  const slug = slugify(input.slug ?? input.title);
  const isPublic = input.visibility === "public" && input.state === "published";

  await pool.query("BEGIN");
  try {
    const pageResult = existingPageId
      ? await pool.query(
          `
            UPDATE pages
            SET
              space_id = $2,
              title = $3,
              slug = $4,
              excerpt = $5,
              visibility = $6,
              state = $7,
              is_public = $8,
              parent_page_id = $9,
              updated_at = now()
            WHERE id = $1
            RETURNING id
          `,
          [
            existingPageId,
            input.spaceId,
            input.title,
            slug,
            input.excerpt ?? null,
            input.visibility,
            input.state,
            isPublic,
            input.parentPageId ?? null
          ]
        )
      : await pool.query(
          `
            INSERT INTO pages (
              space_id, parent_page_id, title, slug, excerpt, visibility, state, is_public, owner_user_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING id
          `,
          [
            input.spaceId,
            input.parentPageId ?? null,
            input.title,
            slug,
            input.excerpt ?? null,
            input.visibility,
            input.state,
            isPublic,
            actorUserId
          ]
        );

    const pageId = pageResult.rows[0].id;

    const revision = await pool.query(
      `
        INSERT INTO page_revisions (
          page_id, title, slug, excerpt, visibility, state, body_markdown, frontmatter, tag_snapshot, edited_by_user_id
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING id
      `,
      [
        pageId,
        input.title,
        slug,
        input.excerpt ?? null,
        input.visibility,
        input.state,
        rendered.bodyMarkdown,
        JSON.stringify(rendered.frontmatter),
        JSON.stringify(input.tagNames ?? []),
        actorUserId
      ]
    );

    await pool.query(`UPDATE pages SET current_revision_id = $2 WHERE id = $1`, [
      pageId,
      revision.rows[0].id
    ]);

    await upsertTags(pageId, input.tagNames);
    await upsertPermissions(pageId, input.allowedRoleKeys, input.allowedGroupIds);

    await pool.query("COMMIT");
    return { pageId, revisionId: revision.rows[0].id, slug };
  } catch (error) {
    await pool.query("ROLLBACK");
    throw error;
  }
}

export async function getPageMetadata(pageId: string, user: SessionUser | null) {
  const page = await pool.query(
    `
      SELECT id, title, slug, visibility, state, updated_at
      FROM pages
      WHERE id = $1
    `,
    [pageId]
  );

  if (!page.rowCount) {
    return null;
  }

  const permissions = await getPagePermissions(pageId);
  const row = page.rows[0];

  if (!canReadVisibility(user, row.visibility, permissions.roleKeys, permissions.groupIds)) {
    return null;
  }

  return {
    ...row,
    permissions
  };
}

export async function listPageRevisions(pageId: string, user: SessionUser | null) {
  const metadata = await getPageMetadata(pageId, user);
  if (!metadata) {
    return null;
  }

  const revisions = await pool.query(
    `
      SELECT pr.id, pr.title, pr.slug, pr.visibility, pr.state, pr.created_at,
             COALESCE(u.display_name, 'Unknown') AS editor_name
      FROM page_revisions pr
      LEFT JOIN users u ON u.id = pr.edited_by_user_id
      WHERE pr.page_id = $1
      ORDER BY pr.created_at DESC
    `,
    [pageId]
  );

  return revisions.rows;
}

export async function rollbackPageRevision(pageId: string, revisionId: string, actorUserId: string) {
  const revision = await pool.query(`SELECT * FROM page_revisions WHERE page_id = $1 AND id = $2`, [
    pageId,
    revisionId
  ]);

  if (!revision.rowCount) {
    return null;
  }

  const currentPage = await pool.query(`SELECT space_id, parent_page_id FROM pages WHERE id = $1`, [pageId]);
  const row = revision.rows[0];

  return createOrUpdatePage(
    pageId,
    {
      spaceId: currentPage.rows[0].space_id,
      parentPageId: currentPage.rows[0].parent_page_id,
      title: row.title,
      slug: row.slug,
      bodyMarkdown: row.body_markdown,
      excerpt: row.excerpt,
      visibility: row.visibility,
      state: row.state,
      tagNames: row.tag_snapshot
    },
    actorUserId
  );
}

export async function getSearchCandidates() {
  const result = await pool.query(
    `
      SELECT
        p.id, p.space_id, p.title, p.slug, p.excerpt, p.visibility, p.state, p.is_public,
        p.parent_page_id, p.updated_at, pr.id AS revision_id, pr.body_markdown,
        COALESCE(u.display_name, 'Unknown') AS author_name
      FROM pages p
      JOIN page_revisions pr ON pr.id = p.current_revision_id
      LEFT JOIN users u ON u.id = pr.edited_by_user_id
      WHERE p.state = 'published'
    `
  );

  return result.rows as PageRecord[];
}
