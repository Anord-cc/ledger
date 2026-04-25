import { useEffect, useMemo, useState } from "react";
import type { PageDetail } from "@ledger/shared";
import { api } from "../lib/api";
import { MarkdownComposerHint } from "./MarkdownComposerHint";

const emptyPage = {
  spaceId: "",
  title: "",
  slug: "",
  bodyMarkdown: "",
  excerpt: "",
  visibility: "internal",
  state: "draft",
  tagNames: [] as string[]
};

function normalizeMarkdownForEmptyState(value: string) {
  return value
    .replace(/\u200B/g, "")
    .replace(/\r\n/g, "\n")
    .trim();
}

function hasMeaningfulMarkdown(value: string) {
  const normalized = normalizeMarkdownForEmptyState(value);
  if (!normalized) {
    return false;
  }

  return normalized !== "# New page\n\nStart writing..." && normalized !== "Start writing...";
}

export function PageEditor({
  spaces,
  initialPage,
  mode = "create",
  variant = "panel",
  onSaved,
  onCancel
}: {
  spaces: Array<{ id: string; name: string; key: string }>;
  initialPage?: (Pick<PageDetail, "id" | "spaceId" | "title" | "slug" | "bodyMarkdown" | "excerpt" | "visibility" | "state" | "tags"> & {
    parentPageId?: string | null;
  }) | null;
  mode?: "create" | "edit";
  variant?: "panel" | "dialog" | "page";
  onSaved?: (slug: string) => void;
  onCancel?: () => void;
}) {
  const createEmptyForm = () => ({
    ...emptyPage,
    spaceId: initialPage?.spaceId ?? spaces[0]?.id ?? "",
    title: initialPage?.title ?? "",
    slug: initialPage?.slug ?? "",
    bodyMarkdown: initialPage?.bodyMarkdown ?? "",
    excerpt: initialPage?.excerpt ?? "",
    visibility: initialPage?.visibility ?? "internal",
    state: initialPage?.state ?? "draft",
    tagNames: initialPage?.tags ?? [],
    parentPageId: initialPage?.parentPageId ?? null
  });

  const [form, setForm] = useState(createEmptyForm);
  const [tagInput, setTagInput] = useState((initialPage?.tags ?? []).join(", "));
  const [status, setStatus] = useState<string | null>(null);
  const isDialog = variant === "dialog";
  const isPage = variant === "page";
  const showMarkdownHelper = useMemo(() => !hasMeaningfulMarkdown(form.bodyMarkdown), [form.bodyMarkdown]);
  const canPublish = form.state === "published";

  useEffect(() => {
    setForm(createEmptyForm());
    setTagInput((initialPage?.tags ?? []).join(", "));
  }, [initialPage, spaces]);

  async function submit(nextState?: "draft" | "published") {
    try {
      const payload = {
        ...form,
        state: nextState ?? form.state,
        tagNames: form.tagNames,
        allowedRoleKeys: form.visibility === "restricted" ? ["viewer"] : []
      };
      const result =
        mode === "edit" && initialPage
          ? await api.put<{ slug: string }>(`/api/pages/${initialPage.id}`, payload)
          : await api.post<{ slug: string }>("/api/pages", payload);
      setStatus(mode === "edit" ? "Document saved." : `Saved page ${result.slug}`);
      if (mode === "create") {
        setForm({
          ...emptyPage,
          spaceId: spaces[0]?.id ?? ""
        });
        setTagInput("");
      }
      onSaved?.(result.slug);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save page");
    }
  }

  return (
    <section className={isPage ? "composer-shell" : isDialog ? "editor-dialog" : "panel"}>
      <div className={`panel__header${isPage ? " composer-header" : ""}`}>
        <div>
          <p className="eyebrow">{mode === "edit" ? "Editor" : "Publishing"}</p>
          <h3>{mode === "edit" ? "Edit document" : isDialog ? "New document" : isPage ? "New document" : "Create a new page"}</h3>
        </div>
        <div className="composer-header__actions">
          <span className="pill">{mode === "edit" ? "Draft editor" : "Editor"}</span>
          {onCancel ? (
            <button type="button" className="button-secondary" onClick={onCancel}>
              Cancel
            </button>
          ) : null}
        </div>
      </div>
      <div className={isPage ? "composer-layout" : "stack-page"}>
        <div className="composer-main">
          <label className="field">
            Title
            <input
              value={form.title}
              placeholder="Untitled document"
              onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
            />
          </label>
          <label className="field">
            Markdown
            {showMarkdownHelper ? <MarkdownComposerHint /> : null}
            <textarea
              className={`editor-textarea${isDialog ? " editor-textarea-dialog" : ""}${isPage ? " editor-textarea-page" : ""}`}
              value={form.bodyMarkdown}
              onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
              placeholder="Write Markdown, use / for blocks, or paste existing docs…"
              aria-label="Document markdown body"
            />
          </label>
        </div>

        <aside className={`composer-sidebar${isPage ? " rail-card" : ""}`}>
          <label className="field">
            Space
            <select
              value={form.spaceId}
              onChange={(event) => setForm((current) => ({ ...current, spaceId: event.target.value }))}
            >
              {spaces.map((space) => (
                <option key={space.id} value={space.id}>
                  {space.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Slug
            <input
              value={form.slug}
              placeholder="generated-from-title"
              onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
            />
          </label>
          <label className="field">
            Excerpt
            <input
              value={form.excerpt}
              placeholder="Short summary shown in lists"
              onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
            />
          </label>
          <div className="field-grid">
            <label className="field">
              Visibility
              <select
                value={form.visibility}
                onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value as "public" | "internal" | "restricted" }))}
              >
                <option value="public">Public</option>
                <option value="internal">Internal</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
            <label className="field">
              State
              <select
                value={form.state}
                onChange={(event) => setForm((current) => ({ ...current, state: event.target.value as "draft" | "published" }))}
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>
          <label className="field">
            Tags
            <input
              value={tagInput}
              placeholder="comma,separated,tags"
              onChange={(event) => {
                const value = event.target.value;
                setTagInput(value);
                setForm((current) => ({
                  ...current,
                  tagNames: value
                    .split(",")
                    .map((tag) => tag.trim())
                    .filter(Boolean)
                }));
              }}
            />
          </label>
          <div className="composer-toolbar">
            <button type="button" onClick={() => void submit("draft")}>
              {mode === "edit" ? "Save draft" : "Create draft"}
            </button>
            <button type="button" className="button-secondary" onClick={() => void submit("published")}>
              {canPublish || mode === "edit" ? "Publish" : "Create and publish"}
            </button>
            {status ? <p className="muted">{status}</p> : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
