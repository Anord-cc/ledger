import { useEffect, useMemo, useState } from "react";
import type { ImportJobSummary, IntegrationSummary, SessionUser } from "@ledger/shared";
import { api } from "../lib/api";
import { EmptyState } from "./EmptyState";
import { PageHeader } from "./PageHeader";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

type ImportSource = "markdown" | "github" | "google_docs";

export function ImportsPage({
  user,
  spaces
}: {
  user: SessionUser | null;
  spaces: Space[];
}) {
  const [source, setSource] = useState<ImportSource>("markdown");
  const [step, setStep] = useState<"configure" | "preview" | "imported">("configure");
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [jobs, setJobs] = useState<ImportJobSummary[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [markdownFiles, setMarkdownFiles] = useState<Array<{ fileName: string; content: string }>>([]);
  const [markdownPreview, setMarkdownPreview] = useState<Array<{ title: string; excerpt?: string }> | null>(null);
  const [github, setGithub] = useState({ repo: "", branch: "main", path: "" });
  const [githubPreview, setGithubPreview] = useState<{ title: string; excerpt?: string } | null>(null);
  const [googleDocId, setGoogleDocId] = useState("");
  const [googlePreview, setGooglePreview] = useState<{ title: string; excerpt?: string } | null>(null);
  const [target, setTarget] = useState({
    spaceId: spaces[0]?.id ?? "",
    visibility: "internal",
    state: "draft"
  });

  const canImport = Boolean(user && user.role !== "viewer" && user.role !== "public");

  const githubIntegration = integrations.find((item) => item.provider === "github");
  const googleIntegration = integrations.find((item) => item.provider === "google_docs");

  useEffect(() => {
    if (!canImport) return;

    api.get<{ integrations: IntegrationSummary[] }>("/api/integrations").then((response) => setIntegrations(response.integrations));
    api.get<{ jobs: ImportJobSummary[] }>("/api/integrations/import-jobs").then((response) => setJobs(response.jobs));
  }, [canImport]);

  const sourceCards = useMemo(
    () => [
      {
        key: "markdown" as const,
        title: "Markdown Import",
        description: "Import one or more Markdown files directly from your browser.",
        status: "Ready"
      },
      {
        key: "github" as const,
        title: "GitHub",
        description: "Import Markdown content from a repository path and branch.",
        status: githubIntegration?.statusMessage ?? "Not configured"
      },
      {
        key: "google_docs" as const,
        title: "Google Docs",
        description: "Import a Google Doc into Markdown while preserving basic formatting.",
        status: googleIntegration?.statusMessage ?? "Not configured"
      }
    ],
    [githubIntegration?.statusMessage, googleIntegration?.statusMessage]
  );

  function sourceBadgeTone(key: ImportSource) {
    if (key === "markdown") return "public";
    if (key === "github") return githubIntegration?.status === "configured" ? "public" : "restricted";
    return googleIntegration?.status === "configured" ? "public" : "restricted";
  }

  async function handleMarkdownFiles(fileList: FileList | null) {
    if (!fileList) return;

    try {
      const files = await Promise.all(
        Array.from(fileList).map(
          (file) =>
            new Promise<{ fileName: string; content: string }>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve({ fileName: file.name, content: String(reader.result ?? "") });
              reader.onerror = () => reject(reader.error);
              reader.readAsText(file);
            })
        )
      );

      setMarkdownFiles(files);
      const response = await api.post<{ documents: Array<{ title: string; excerpt?: string }> }>("/api/integrations/markdown/preview", {
        files
      });
      setMarkdownPreview(response.documents);
      setStep("preview");
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview Markdown files.");
    }
  }

  async function previewGithub() {
    try {
      const response = await api.post<{ document: { title: string; excerpt?: string } }>("/api/integrations/github/preview", github);
      setGithubPreview(response.document);
      setStep("preview");
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview GitHub content.");
    }
  }

  async function previewGoogle() {
    try {
      const response = await api.post<{ document: { title: string; excerpt?: string } }>("/api/integrations/google-docs/preview", {
        documentId: googleDocId
      });
      setGooglePreview(response.document);
      setStep("preview");
      setStatus(null);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not preview Google Docs content.");
    }
  }

  async function runImport() {
    try {
      if (source === "markdown") {
        await api.post("/api/integrations/markdown/import", { files: markdownFiles, target });
      }

      if (source === "github") {
        await api.post("/api/integrations/github/import", { ...github, target });
      }

      if (source === "google_docs") {
        await api.post("/api/integrations/google-docs/import", { documentId: googleDocId, target });
      }

      setStatus("Import completed successfully.");
      setStep("imported");
      if (canImport) {
        const response = await api.get<{ jobs: ImportJobSummary[] }>("/api/integrations/import-jobs");
        setJobs(response.jobs);
      }
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Import failed.");
    }
  }

  const sourceReady =
    source === "markdown" ||
    (source === "github" && githubIntegration?.status === "configured") ||
    (source === "google_docs" && googleIntegration?.status === "configured");

  return (
    <div className="stack-page">
      <PageHeader
        eyebrow="Imports"
        title="Import documentation"
        description="Select a source, preview imported content, choose the target space, and keep a clean history of every import run."
      />

      {!canImport ? (
        <section className="panel">
          <EmptyState
            title="Imports require editor access"
            description="Sign in with an editor, admin, or owner account to import content into Ledger."
          />
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Step 1</p>
                <h3>Select a source</h3>
              </div>
            </div>
            <div className="integration-list">
              {sourceCards.map((card) => (
                <button
                  key={card.key}
                  type="button"
                  className={`integration-card integration-card--selectable${source === card.key ? " is-selected" : ""}`}
                  onClick={() => {
                    setSource(card.key);
                    setStep("configure");
                  }}
                >
                  <div className="feedback-item__header">
                    <strong>{card.title}</strong>
                    <span className={`badge badge-${sourceBadgeTone(card.key)}`}>
                      {card.status}
                    </span>
                  </div>
                  <p>{card.description}</p>
                </button>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Step 2</p>
                <h3>Configure target</h3>
              </div>
            </div>
            <div className="field-grid">
              <label className="field">
                Target space
                <select value={target.spaceId} onChange={(event) => setTarget((current) => ({ ...current, spaceId: event.target.value }))}>
                  {spaces.map((space) => (
                    <option key={space.id} value={space.id}>
                      {space.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                Publish state
                <select value={target.state} onChange={(event) => setTarget((current) => ({ ...current, state: event.target.value }))}>
                  <option value="draft">Draft</option>
                  <option value="published">Published</option>
                </select>
              </label>
            </div>
            <label className="field">
              Visibility
              <select value={target.visibility} onChange={(event) => setTarget((current) => ({ ...current, visibility: event.target.value }))}>
                <option value="internal">Internal</option>
                <option value="public">Public</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Step 3</p>
                <h3>Preview source content</h3>
              </div>
            </div>

            {!sourceReady ? (
              <EmptyState
                title="Source not configured"
                description={`Configure ${source === "github" ? "GitHub" : source === "google_docs" ? "Google Docs" : "Markdown import"} before previewing imports.`}
              />
            ) : null}

            {source === "markdown" ? (
              <div className="stack">
                <input type="file" accept=".md,.markdown,text/markdown" multiple onChange={(event) => void handleMarkdownFiles(event.target.files)} />
                <p className="muted">Multiple-file upload is supported directly. Folder upload varies by browser, so Ledger uses multiple files as the reliable default.</p>
                {markdownPreview ? (
                  <div className="preview-list">
                    {markdownPreview.map((document) => (
                      <div key={document.title} className="preview-item">
                        <strong>{document.title}</strong>
                        <p>{document.excerpt ?? "No excerpt available."}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            {source === "github" ? (
              <div className="stack">
                <div className="field-grid">
                  <label className="field">
                    Repository
                    <input value={github.repo} onChange={(event) => setGithub((current) => ({ ...current, repo: event.target.value }))} placeholder="org/repo" />
                  </label>
                  <label className="field">
                    Branch
                    <input value={github.branch} onChange={(event) => setGithub((current) => ({ ...current, branch: event.target.value }))} />
                  </label>
                </div>
                <label className="field">
                  Path
                  <input value={github.path} onChange={(event) => setGithub((current) => ({ ...current, path: event.target.value }))} placeholder="docs/getting-started.md" />
                </label>
                <div className="panel__footer">
                  <button type="button" className="button-secondary" disabled={!github.repo || !github.path || !sourceReady} onClick={previewGithub}>
                    Preview GitHub file
                  </button>
                </div>
                {githubPreview ? <div className="preview-item"><strong>{githubPreview.title}</strong><p>{githubPreview.excerpt ?? "No excerpt available."}</p></div> : null}
              </div>
            ) : null}

            {source === "google_docs" ? (
              <div className="stack">
                <label className="field">
                  Google Doc ID
                  <input value={googleDocId} onChange={(event) => setGoogleDocId(event.target.value)} placeholder="Document ID" />
                </label>
                <div className="panel__footer">
                  <button type="button" className="button-secondary" disabled={!googleDocId || !sourceReady} onClick={previewGoogle}>
                    Preview Google Doc
                  </button>
                </div>
                {googlePreview ? <div className="preview-item"><strong>{googlePreview.title}</strong><p>{googlePreview.excerpt ?? "No excerpt available."}</p></div> : null}
              </div>
            ) : null}
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Step 4</p>
                <h3>Import</h3>
              </div>
            </div>
            <div className="panel__footer">
              <button
                type="button"
                disabled={
                  !sourceReady ||
                  (source === "markdown" && !markdownPreview?.length) ||
                  (source === "github" && !githubPreview) ||
                  (source === "google_docs" && !googlePreview)
                }
                onClick={runImport}
              >
                Import into Ledger
              </button>
              {status ? <p className="muted">{status}</p> : null}
              {step === "imported" ? <p className="muted">Import finished. Source metadata will appear on imported pages.</p> : null}
            </div>
          </section>

          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">History</p>
                <h3>Recent imports</h3>
              </div>
            </div>
            {jobs.length === 0 ? (
              <EmptyState
                title="No imports recorded yet"
                description="Import history will appear here after you complete your first import."
              />
            ) : (
              <div className="feedback-list">
                {jobs.map((job) => (
                  <div key={job.id} className="feedback-item">
                    <div className="feedback-item__header">
                      <strong>{job.sourceLabel}</strong>
                      <span className={`badge badge-${job.status === "completed" ? "public" : "restricted"}`}>{job.status}</span>
                    </div>
                    <p>{job.provider} • {job.importedCount} pages</p>
                    {job.errorMessage ? <p className="muted">{job.errorMessage}</p> : null}
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
