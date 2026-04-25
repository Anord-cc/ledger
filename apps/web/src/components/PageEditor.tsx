import { useMemo, useState } from "react";
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
  variant = "panel",
  onCreated,
  onCancel
}: {
  spaces: Array<{ id: string; name: string; key: string }>;
  variant?: "panel" | "dialog";
  onCreated?: (slug: string) => void;
  onCancel?: () => void;
}) {
  const [form, setForm] = useState({
    ...emptyPage,
    spaceId: spaces[0]?.id ?? ""
  });
  const [status, setStatus] = useState<string | null>(null);
  const isDialog = variant === "dialog";
  const showMarkdownHelper = useMemo(() => !hasMeaningfulMarkdown(form.bodyMarkdown), [form.bodyMarkdown]);

  async function submit() {
    try {
      const result = await api.post<{ slug: string }>("/api/pages", {
        ...form,
        tagNames: form.tagNames,
        allowedRoleKeys: form.visibility === "restricted" ? ["viewer"] : []
      });
      setStatus(`Saved page ${result.slug}`);
      setForm({
        ...emptyPage,
        spaceId: spaces[0]?.id ?? ""
      });
      onCreated?.(result.slug);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save page");
    }
  }

  return (
    <section className={isDialog ? "editor-dialog" : "panel"}>
      <div className="panel__header">
        <div>
          <p className="eyebrow">Publishing</p>
          <h3>{isDialog ? "New document" : "Create a new page"}</h3>
        </div>
        <span className="pill">Editor</span>
      </div>
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
        Title
        <input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <label className="field">
        Slug
        <input
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
        />
      </label>
      <label className="field">
        Excerpt
        <input
          value={form.excerpt}
          onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
        />
      </label>
      <div className="field-grid">
        <label className="field">
          Visibility
          <select
            value={form.visibility}
            onChange={(event) => setForm((current) => ({ ...current, visibility: event.target.value }))}
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
            onChange={(event) => setForm((current) => ({ ...current, state: event.target.value }))}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </label>
      </div>
      <label className="field">
        Tags
        <input
          placeholder="comma,separated,tags"
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              tagNames: event.target.value
                .split(",")
                .map((tag) => tag.trim())
                .filter(Boolean)
            }))
          }
        />
      </label>
      <label className="field">
        Markdown
        {showMarkdownHelper ? <MarkdownComposerHint /> : null}
        <textarea
          className={`editor-textarea${isDialog ? " editor-textarea-dialog" : ""}`}
          value={form.bodyMarkdown}
          onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
          placeholder="Write Markdown, use / for blocks, or paste existing docs…"
          aria-label="Document markdown body"
        />
      </label>
      <div className="panel__footer">
        <button onClick={submit}>Create draft</button>
        {onCancel ? (
          <button type="button" className="button-secondary" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        {status ? <p className="muted">{status}</p> : null}
      </div>
    </section>
  );
}
