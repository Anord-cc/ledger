import matter from "gray-matter";
import type { IntegrationSummary, PageState, RoleKey, Visibility } from "@ledger/shared";
import { pool } from "../db/pool.js";
import { createOrUpdatePage } from "./pages.js";

type ImportTarget = {
  spaceId: string;
  visibility: Visibility;
  state: PageState;
  parentPageId?: string | null;
  allowedRoleKeys?: RoleKey[];
  allowedGroupIds?: string[];
};

type ParsedImportDocument = {
  title: string;
  slug?: string;
  excerpt?: string;
  bodyMarkdown: string;
  tagNames?: string[];
  source: {
    provider: "markdown_import" | "github" | "google_docs";
    identifier: string;
    url: string | null;
    title: string | null;
    branch?: string | null;
    path?: string | null;
    documentId?: string | null;
    metadata?: Record<string, unknown>;
  };
};

function sanitizeIntegrationConfig(provider: string, config: Record<string, unknown>) {
  const secretKeys = ["token", "accessToken", "clientSecret", "apiKey", "signingSecret"];
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    sanitized[key] = secretKeys.includes(key) && value ? "Configured" : value;
  }

  return sanitized;
}

function getIntegrationAvailability(provider: string, config: Record<string, unknown>) {
  if (provider === "markdown_import") {
    return {
      status: "configured" as const,
      statusMessage: "Markdown import is available."
    };
  }

  if (provider === "github") {
    const token = String(config.token ?? "").trim();
    return token
      ? {
          status: "configured" as const,
          statusMessage: "GitHub import is configured."
        }
      : {
          status: "missing_credentials" as const,
          statusMessage: "Add a GitHub token to enable repository imports."
        };
  }

  const accessToken = String(config.accessToken ?? "").trim();
  return accessToken
    ? {
        status: "configured" as const,
        statusMessage: "Google Docs import is configured."
      }
    : {
        status: "missing_credentials" as const,
        statusMessage: "Add a Google access token to enable Docs imports."
      };
}

function parsedTitleFromFrontmatter(title: string | undefined, fallback: string) {
  const normalized = title?.trim();
  return normalized || fallback;
}

function deriveExcerpt(bodyMarkdown: string, explicitExcerpt?: string) {
  if (explicitExcerpt?.trim()) {
    return explicitExcerpt.trim().slice(0, 240);
  }

  return bodyMarkdown
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/[#>*_\-\[\]\(\)`]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 240);
}

function parseMarkdownDocument(content: string, fallbackTitle: string, source: ParsedImportDocument["source"]) {
  const parsed = matter(content);
  const frontmatter = parsed.data as Record<string, unknown>;
  const title = parsedTitleFromFrontmatter(
    typeof frontmatter.title === "string" ? frontmatter.title : undefined,
    fallbackTitle
  );
  const excerpt = deriveExcerpt(parsed.content, typeof frontmatter.excerpt === "string" ? frontmatter.excerpt : undefined);
  const tagNames = Array.isArray(frontmatter.tags)
    ? frontmatter.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  return {
    title,
    slug: typeof frontmatter.slug === "string" ? frontmatter.slug : undefined,
    excerpt,
    bodyMarkdown: parsed.content.trim(),
    tagNames,
    source: {
      ...source,
      metadata: {
        frontmatter
      }
    }
  } satisfies ParsedImportDocument;
}

function formatText(text: string, style?: Record<string, unknown>) {
  let output = text.replace(/\n/g, "");
  if (!output) {
    return "";
  }

  const link = style?.link as { url?: string } | undefined;
  if (link?.url) {
    output = `[${output}](${link.url})`;
  }

  if (style?.bold) output = `**${output}**`;
  if (style?.italic) output = `_${output}_`;
  if (style?.code) output = `\`${output}\``;
  return output;
}

function googleDocsToMarkdown(doc: Record<string, unknown>) {
  const body = (doc.body as { content?: Array<Record<string, unknown>> } | undefined)?.content ?? [];
  const inlineObjects = (doc.inlineObjects as Record<string, { inlineObjectProperties?: { embeddedObject?: { imageProperties?: { contentUri?: string } } } }> | undefined) ?? {};
  const lines: string[] = [];

  for (const block of body) {
    const paragraph = block.paragraph as
      | {
          elements?: Array<Record<string, unknown>>;
          paragraphStyle?: { namedStyleType?: string };
          bullet?: Record<string, unknown>;
        }
      | undefined;

    if (!paragraph) {
      continue;
    }

    const styleName = paragraph.paragraphStyle?.namedStyleType ?? "NORMAL_TEXT";
    const prefix =
      styleName === "HEADING_1"
        ? "# "
        : styleName === "HEADING_2"
          ? "## "
          : styleName === "HEADING_3"
            ? "### "
            : paragraph.bullet
              ? "- "
              : "";

    let line = "";

    for (const element of paragraph.elements ?? []) {
      const textRun = element.textRun as { content?: string; textStyle?: Record<string, unknown> } | undefined;
      if (textRun?.content) {
        line += formatText(textRun.content, textRun.textStyle);
      }

      const inlineObjectElement = element.inlineObjectElement as { inlineObjectId?: string } | undefined;
      if (inlineObjectElement?.inlineObjectId) {
        const imageUri =
          inlineObjects[inlineObjectElement.inlineObjectId]?.inlineObjectProperties?.embeddedObject?.imageProperties
            ?.contentUri;
        if (imageUri) {
          line += ` ![](${imageUri})`;
        }
      }
    }

    const normalized = line.trim();
    if (normalized) {
      lines.push(`${prefix}${normalized}`);
      lines.push("");
    }
  }

  return lines.join("\n").trim();
}

async function fetchGitHubMarkdown(config: Record<string, unknown>, repo: string, branch: string, filePath: string) {
  const token = String(config.token ?? "").trim();
  if (!token) {
    throw new Error("GitHub integration is not configured.");
  }

  const response = await fetch(
    `https://api.github.com/repos/${repo}/contents/${filePath}?ref=${encodeURIComponent(branch)}`,
    {
      headers: {
        Accept: "application/vnd.github.raw+json",
        Authorization: `Bearer ${token}`,
        "User-Agent": "Ledger"
      }
    }
  );

  if (!response.ok) {
    throw new Error(`GitHub import failed with status ${response.status}`);
  }

  const bodyMarkdown = await response.text();
  const fallbackTitle = filePath.split("/").pop()?.replace(/\.md$/i, "") ?? "Imported page";
  return parseMarkdownDocument(bodyMarkdown, fallbackTitle, {
    provider: "github",
    identifier: `${repo}:${branch}:${filePath}`,
    url: `https://github.com/${repo}/blob/${branch}/${filePath}`,
    title: fallbackTitle,
    branch,
    path: filePath
  });
}

async function fetchGoogleDoc(config: Record<string, unknown>, documentId: string) {
  const accessToken = String(config.accessToken ?? "").trim();
  if (!accessToken) {
    throw new Error("Google Docs integration is not configured.");
  }

  const response = await fetch(`https://docs.googleapis.com/v1/documents/${documentId}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error(`Google Docs import failed with status ${response.status}`);
  }

  const doc = (await response.json()) as Record<string, unknown>;
  const bodyMarkdown = googleDocsToMarkdown(doc);
  const title = String(doc.title ?? "Imported Google Doc");
  return parseMarkdownDocument(bodyMarkdown, title, {
    provider: "google_docs",
    identifier: documentId,
    url: `https://docs.google.com/document/d/${documentId}/edit`,
    title,
    documentId
  });
}

export async function listIntegrations() {
  const result = await pool.query(`SELECT * FROM integrations ORDER BY provider ASC, created_at DESC`);

  return result.rows.map((row) => {
    const config = row.config as Record<string, unknown>;
    const availability = getIntegrationAvailability(row.provider, config);
    return {
      id: row.id,
      provider: row.provider,
      name: row.name,
      isEnabled: row.is_enabled,
      config: sanitizeIntegrationConfig(row.provider, config),
      status: row.is_enabled ? availability.status : "disabled",
      statusMessage: row.is_enabled ? availability.statusMessage : "Integration is disabled.",
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    } satisfies IntegrationSummary;
  });
}

export async function getIntegrationByProvider(provider: "github" | "google_docs" | "markdown_import") {
  const existing = await pool.query(`SELECT * FROM integrations WHERE provider = $1 ORDER BY created_at DESC LIMIT 1`, [provider]);
  return existing.rows[0] ?? null;
}

export async function upsertIntegration(provider: "github" | "google_docs" | "markdown_import", input: {
  name: string;
  config: Record<string, unknown>;
  isEnabled: boolean;
}) {
  const existing = await getIntegrationByProvider(provider);
  const mergedConfig = existing
    ? {
        ...(existing.config as Record<string, unknown>),
        ...Object.fromEntries(
          Object.entries(input.config).filter(([, value]) => value !== "")
        )
      }
    : input.config;
  if (existing) {
    const updated = await pool.query(
      `
        UPDATE integrations
        SET name = $2, config = $3, is_enabled = $4, updated_at = now()
        WHERE id = $1
        RETURNING *
      `,
      [existing.id, input.name, JSON.stringify(mergedConfig), input.isEnabled]
    );
    return updated.rows[0];
  }

  const created = await pool.query(
    `
      INSERT INTO integrations (provider, name, config, is_enabled)
      VALUES ($1, $2, $3, $4)
      RETURNING *
    `,
    [provider, input.name, JSON.stringify(mergedConfig), input.isEnabled]
  );
  return created.rows[0];
}

export async function listImportJobs() {
  const result = await pool.query(`SELECT * FROM import_jobs ORDER BY created_at DESC LIMIT 50`);
  return result.rows.map((row) => ({
    id: row.id,
    provider: row.provider,
    sourceLabel: row.source_label,
    status: row.status,
    importedCount: row.imported_count,
    errorMessage: row.error_message,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString()
  }));
}

async function recordImportJob(provider: string, sourceLabel: string, target: ImportTarget, actorUserId: string, metadata: Record<string, unknown>) {
  const created = await pool.query(
    `
      INSERT INTO import_jobs (provider, source_label, space_id, status, imported_by_user_id, metadata)
      VALUES ($1, $2, $3, 'pending', $4, $5)
      RETURNING id
    `,
    [provider, sourceLabel, target.spaceId, actorUserId, JSON.stringify(metadata)]
  );
  return created.rows[0].id as string;
}

async function finalizeImportJob(jobId: string, pageIds: string[]) {
  await pool.query(
    `
      UPDATE import_jobs
      SET status = 'completed', imported_count = $2, page_ids = $3, updated_at = now()
      WHERE id = $1
    `,
    [jobId, pageIds.length, JSON.stringify(pageIds)]
  );
}

async function failImportJob(jobId: string, error: string) {
  await pool.query(
    `
      UPDATE import_jobs
      SET status = 'failed', error_message = $2, updated_at = now()
      WHERE id = $1
    `,
    [jobId, error]
  );
}

async function upsertExternalSource(pageId: string, actorUserId: string, source: ParsedImportDocument["source"]) {
  await pool.query(
    `
      INSERT INTO external_page_sources (
        page_id, provider, source_url, source_title, source_branch, source_path,
        source_document_id, source_identifier, imported_by_user_id, imported_at, last_synced_at, metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, now(), now(), $10)
      ON CONFLICT (page_id) DO UPDATE
      SET provider = EXCLUDED.provider,
          source_url = EXCLUDED.source_url,
          source_title = EXCLUDED.source_title,
          source_branch = EXCLUDED.source_branch,
          source_path = EXCLUDED.source_path,
          source_document_id = EXCLUDED.source_document_id,
          source_identifier = EXCLUDED.source_identifier,
          imported_by_user_id = EXCLUDED.imported_by_user_id,
          last_synced_at = now(),
          metadata = EXCLUDED.metadata
    `,
    [
      pageId,
      source.provider,
      source.url,
      source.title,
      source.branch ?? null,
      source.path ?? null,
      source.documentId ?? null,
      source.identifier,
      actorUserId,
      JSON.stringify(source.metadata ?? {})
    ]
  );
}

async function importDocuments(documents: ParsedImportDocument[], target: ImportTarget, actorUserId: string, sourceLabel: string) {
  const jobId = await recordImportJob(documents[0]?.source.provider ?? "markdown_import", sourceLabel, target, actorUserId, {
    totalDocuments: documents.length
  });

  try {
    const pageIds: string[] = [];
    for (const document of documents) {
      const result = await createOrUpdatePage(
        null,
        {
          spaceId: target.spaceId,
          title: document.title,
          slug: document.slug,
          excerpt: document.excerpt,
          bodyMarkdown: document.bodyMarkdown,
          visibility: target.visibility,
          state: target.state,
          parentPageId: target.parentPageId ?? null,
          tagNames: document.tagNames,
          allowedRoleKeys: target.allowedRoleKeys,
          allowedGroupIds: target.allowedGroupIds
        },
        actorUserId
      );

      pageIds.push(result.pageId);
      await upsertExternalSource(result.pageId, actorUserId, document.source);
    }

    await finalizeImportJob(jobId, pageIds);
    return { jobId, pageIds };
  } catch (error) {
    await failImportJob(jobId, error instanceof Error ? error.message : "Import failed");
    throw error;
  }
}

export function previewMarkdownImports(files: Array<{ fileName: string; content: string }>) {
  return files.map((file) =>
    parseMarkdownDocument(file.content, file.fileName.replace(/\.md$/i, ""), {
      provider: "markdown_import",
      identifier: file.fileName,
      url: null,
      title: file.fileName
    })
  );
}

export async function importMarkdownDocuments(files: Array<{ fileName: string; content: string }>, target: ImportTarget, actorUserId: string) {
  const documents = previewMarkdownImports(files);
  return importDocuments(documents, target, actorUserId, files.length === 1 ? files[0].fileName : `${files.length} Markdown files`);
}

export async function previewGitHubImport(repo: string, branch: string, filePath: string) {
  const integration = await getIntegrationByProvider("github");
  if (!integration?.is_enabled) {
    throw new Error("GitHub import is disabled.");
  }
  return fetchGitHubMarkdown(integration.config as Record<string, unknown>, repo, branch, filePath);
}

export async function importGitHubDocument(repo: string, branch: string, filePath: string, target: ImportTarget, actorUserId: string) {
  const document = await previewGitHubImport(repo, branch, filePath);
  return importDocuments([document], target, actorUserId, `${repo}:${branch}:${filePath}`);
}

export async function previewGoogleDocImport(documentId: string) {
  const integration = await getIntegrationByProvider("google_docs");
  if (!integration?.is_enabled) {
    throw new Error("Google Docs import is disabled.");
  }
  return fetchGoogleDoc(integration.config as Record<string, unknown>, documentId);
}

export async function importGoogleDoc(documentId: string, target: ImportTarget, actorUserId: string) {
  const document = await previewGoogleDocImport(documentId);
  return importDocuments([document], target, actorUserId, `Google Doc ${documentId}`);
}
