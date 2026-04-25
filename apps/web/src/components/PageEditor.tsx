import { useState } from "react";
import { api } from "../lib/api";

const emptyPage = {
  spaceId: "",
  title: "",
  slug: "",
  bodyMarkdown: "# New page\n\nStart writing...",
  excerpt: "",
  visibility: "internal",
  state: "draft",
  tagNames: [] as string[]
};

export function PageEditor({ spaces }: { spaces: Array<{ id: string; name: string; key: string }> }) {
  const [form, setForm] = useState({
    ...emptyPage,
    spaceId: spaces[0]?.id ?? ""
  });
  const [status, setStatus] = useState<string | null>(null);

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
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save page");
    }
  }

  return (
    <section className="card">
      <div className="row">
        <h3>Create page</h3>
        <span className="pill">Editor</span>
      </div>
      <label>
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
      <label>
        Title
        <input
          value={form.title}
          onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
        />
      </label>
      <label>
        Slug
        <input
          value={form.slug}
          onChange={(event) => setForm((current) => ({ ...current, slug: event.target.value }))}
        />
      </label>
      <label>
        Excerpt
        <input
          value={form.excerpt}
          onChange={(event) => setForm((current) => ({ ...current, excerpt: event.target.value }))}
        />
      </label>
      <div className="split">
        <label>
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
        <label>
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
      <label>
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
      <label>
        Markdown
        <textarea
          className="editor-textarea"
          value={form.bodyMarkdown}
          onChange={(event) => setForm((current) => ({ ...current, bodyMarkdown: event.target.value }))}
        />
      </label>
      <button onClick={submit}>Save page</button>
      {status ? <p className="muted">{status}</p> : null}
    </section>
  );
}
