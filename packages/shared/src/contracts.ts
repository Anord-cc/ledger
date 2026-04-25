export type RoleKey = "owner" | "admin" | "editor" | "viewer" | "public";
export type Visibility = "public" | "internal" | "restricted";
export type PageState = "draft" | "published";

export interface SessionUser {
  id: string;
  email: string;
  displayName: string;
  role: RoleKey;
  groupIds: string[];
}

export interface SpaceSummary {
  id: string;
  name: string;
  key: string;
  visibility: Visibility;
}

export interface PageSummary {
  id: string;
  spaceId: string;
  title: string;
  slug: string;
  excerpt: string | null;
  visibility: Visibility;
  state: PageState;
  isPublic: boolean;
  parentPageId: string | null;
  tags: string[];
  updatedAt: string;
}

export interface PageDetail extends PageSummary {
  bodyMarkdown: string;
  bodyHtml: string;
  toc: Array<{ id: string; text: string; level: number }>;
  revisionId: string;
  authorName: string;
  source: ExternalSourceMetadata | null;
}

export interface ExternalSourceMetadata {
  provider: "markdown_import" | "github" | "google_docs";
  sourceUrl: string | null;
  sourceTitle: string | null;
  sourceBranch: string | null;
  sourcePath: string | null;
  sourceDocumentId: string | null;
  importedAt: string;
  importedBy: string | null;
  lastSyncedAt: string | null;
}

export interface SearchResponse {
  query: string;
  total: number;
  pages: PageSummary[];
}

export interface FeedbackPayload {
  pageId: string;
  revisionId?: string;
  helpful: boolean;
  comment?: string;
}

export interface BrandingSettings {
  siteName: string;
  logoUrl: string | null;
  brandColor: string;
  publicKnowledgeBaseEnabled: boolean;
  footerLinks: Array<{ label: string; href: string }>;
}

export interface SmtpSettings {
  host: string;
  port: number;
  username: string;
  fromEmail: string;
  fromName: string;
}

export interface AiSettings {
  provider: string;
  model: string;
  enabled: boolean;
}

export interface IntegrationSummary {
  id: string;
  provider: "github" | "google_docs" | "markdown_import";
  name: string;
  isEnabled: boolean;
  config: Record<string, unknown>;
  status: "configured" | "missing_credentials" | "disabled";
  statusMessage: string;
  createdAt: string;
  updatedAt: string;
}

export interface ImportJobSummary {
  id: string;
  provider: string;
  sourceLabel: string;
  status: string;
  importedCount: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookSummary {
  id: string;
  name: string;
  targetUrl: string;
  isActive: boolean;
  events: string[];
  createdAt: string;
}

export interface WebhookDeliverySummary {
  id: string;
  eventName: string;
  responseStatus: number | null;
  success: boolean | null;
  deliveredAt: string | null;
  createdAt: string;
  errorMessage: string | null;
  attemptCount: number;
}

export interface AiCitation {
  title: string;
  slug: string;
}

export interface PageUpsertInput {
  spaceId: string;
  title: string;
  slug?: string;
  bodyMarkdown: string;
  excerpt?: string;
  visibility: Visibility;
  state: PageState;
  parentPageId?: string | null;
  tagNames?: string[];
  allowedRoleKeys?: RoleKey[];
  allowedGroupIds?: string[];
}
