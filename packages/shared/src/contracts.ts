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
  footerText: string | null;
  publicKnowledgeBaseEnabled: boolean;
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
