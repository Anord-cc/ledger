import { useEffect, useState } from "react";
import type {
  ImportJobSummary,
  IntegrationSummary,
  SessionUser,
  WebhookDeliverySummary,
  WebhookSummary
} from "@ledger/shared";
import { api } from "../lib/api";
import { PageEditor } from "./PageEditor";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

type AdminFeedback = Array<{ id: string; page_title: string; helpful: boolean; comment: string | null }>;

export function DashboardView({ user, spaces }: { user: SessionUser; spaces: Space[] }) {
  const canAdmin = user.role === "admin" || user.role === "owner";
  const canEdit = canAdmin || user.role === "editor";
  const [analytics, setAnalytics] = useState<{
    topSearches: Array<{ query: string; count: number }>;
    noResults: Array<{ query: string; count: number }>;
  } | null>(null);
  const [feedback, setFeedback] = useState<AdminFeedback | null>(null);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDeliverySummary[]>>({});
  const [aiSettings, setAiSettings] = useState({
    provider: "none",
    model: "",
    isEnabled: false,
    hasApiKey: false,
    apiKey: ""
  });
  const [brandingForm, setBrandingForm] = useState({
    siteName: "Ledger",
    logoUrl: "",
    brandColor: "#245cff",
    footerText: "",
    publicKnowledgeBaseEnabled: true
  });
  const [status, setStatus] = useState<string | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    targetUrl: "",
    signingSecret: "",
    isActive: true,
    events: "page.created, page.updated"
  });
  const [integrationForms, setIntegrationForms] = useState<Record<string, { name: string; isEnabled: boolean; token: string; accessToken: string }>>({
    github: { name: "GitHub", isEnabled: false, token: "", accessToken: "" },
    google_docs: { name: "Google Docs", isEnabled: false, token: "", accessToken: "" },
    markdown_import: { name: "Markdown import", isEnabled: true, token: "", accessToken: "" }
  });
  const [markdownFiles, setMarkdownFiles] = useState<Array<{ fileName: string; content: string }>>([]);
  const [markdownPreview, setMarkdownPreview] = useState<Array<{ title: string; excerpt?: string }> | null>(null);
  const [githubImport, setGithubImport] = useState({ repo: "", branch: "main", path: "" });
  const [githubPreview, setGithubPreview] = useState<{ title: string; excerpt?: string } | null>(null);
  const [googleImport, setGoogleImport] = useState({ documentId: "" });
  const [googlePreview, setGooglePreview] = useState<{ title: string; excerpt?: string } | null>(null);
  const [importTarget, setImportTarget] = useState({
    spaceId: spaces[0]?.id ?? "",
    visibility: "internal",
    state: "draft"
  });

  async function loadAdminData() {
    if (!canAdmin) {
      return;
    }

    const [analyticsResponse, feedbackResponse, settingsResponse, integrationsResponse, jobsResponse, aiResponse, webhookResponse] =
      await Promise.all([
        api.get<{ topSearches: Array<{ query: string; count: number }>; noResults: Array<{ query: string; count: number }> }>("/api/admin/search-analytics"),
        api.get<{ feedback: AdminFeedback }>("/api/admin/feedback"),
        api.get<{ branding: { site_name: string; logo_url: string | null; brand_color: string; footer_text: string | null; public_knowledge_base_enabled: boolean } }>("/api/settings/admin"),
        api.get<{ integrations: IntegrationSummary[] }>("/api/integrations"),
        api.get<{ jobs: ImportJobSummary[] }>("/api/integrations/import-jobs"),
        api.get<{ settings: { provider: string; model: string; isEnabled: boolean; hasApiKey: boolean } }>("/api/ai/settings"),
        api.get<{ webhooks: WebhookSummary[] }>("/api/webhooks")
      ]);

    setAnalytics(analyticsResponse);
    setFeedback(feedbackResponse.feedback);
    setIntegrations(integrationsResponse.integrations);
    setImportJobs(jobsResponse.jobs);
    setAiSettings((current) => ({ ...current, ...aiResponse.settings, apiKey: "" }));
    setWebhooks(webhookResponse.webhooks);
    setBrandingForm({
      siteName: settingsResponse.branding.site_name,
      logoUrl: settingsResponse.branding.logo_url ?? "",
      brandColor: settingsResponse.branding.brand_color,
      footerText: settingsResponse.branding.footer_text ?? "",
      publicKnowledgeBaseEnabled: settingsResponse.branding.public_knowledge_base_enabled
    });
  }

  useEffect(() => {
    void loadAdminData();
  }, [canAdmin]);

  async function saveBranding() {
    await api.put("/api/settings/branding", {
      siteName: brandingForm.siteName,
      logoUrl: brandingForm.logoUrl || null,
      brandColor: brandingForm.brandColor,
      footerText: brandingForm.footerText || null,
      publicKnowledgeBaseEnabled: brandingForm.publicKnowledgeBaseEnabled
    });
    setStatus("Workspace settings saved.");
  }

  async function saveIntegration(provider: "github" | "google_docs" | "markdown_import") {
    const form = integrationForms[provider];
    const config =
      provider === "github"
        ? { token: form.token }
        : provider === "google_docs"
          ? { accessToken: form.accessToken }
          : {};

    await api.put(`/api/integrations/${provider}`, {
      name: form.name,
      isEnabled: form.isEnabled,
      config
    });
    setStatus(`${provider} settings saved.`);
    await loadAdminData();
  }

  async function loadDeliveries(webhookId: string) {
    const response = await api.get<{ deliveries: WebhookDeliverySummary[] }>(`/api/webhooks/${webhookId}/deliveries`);
    setDeliveries((current) => ({ ...current, [webhookId]: response.deliveries }));
  }

  async function createWebhook() {
    await api.post("/api/webhooks", {
      ...webhookForm,
      events: webhookForm.events.split(",").map((value) => value.trim()).filter(Boolean)
    });
    setStatus("Webhook created.");
    await loadAdminData();
  }

  async function deleteWebhook(webhookId: string) {
    if (!window.confirm("Delete this webhook and its recent deliveries?")) return;
    await api.delete(`/api/webhooks/${webhookId}`);
    setStatus("Webhook deleted.");
    await loadAdminData();
  }

  async function saveAi() {
    await api.put("/api/ai/settings", {
      provider: aiSettings.provider,
      model: aiSettings.model,
      apiKey: aiSettings.apiKey || null,
      isEnabled: aiSettings.isEnabled
    });
    setStatus("AI settings saved.");
    await loadAdminData();
  }

  async function handleMarkdownFiles(fileList: FileList | null) {
    if (!fileList) return;

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
  }

  async function runMarkdownImport() {
    await api.post("/api/integrations/markdown/import", {
      files: markdownFiles,
      target: importTarget
    });
    setStatus("Markdown import completed.");
    await loadAdminData();
  }

  async function previewGithubImport() {
    const response = await api.post<{ document: { title: string; excerpt?: string } }>("/api/integrations/github/preview", githubImport);
    setGithubPreview(response.document);
  }

  async function runGithubImport() {
    await api.post("/api/integrations/github/import", {
      ...githubImport,
      target: importTarget
    });
    setStatus("GitHub import completed.");
    await loadAdminData();
  }

  async function previewGoogleImport() {
    const response = await api.post<{ document: { title: string; excerpt?: string } }>("/api/integrations/google-docs/preview", googleImport);
    setGooglePreview(response.document);
  }

  async function runGoogleImport() {
    await api.post("/api/integrations/google-docs/import", {
      ...googleImport,
      target: importTarget
    });
    setStatus("Google Docs import completed.");
    await loadAdminData();
  }

  return (
    <div className="manage-layout">
      <section className="panel manage-hero">
        <div>
          <p className="eyebrow">Manage workspace</p>
          <h1>{user.displayName}</h1>
          <p className="lede">Publish docs, import trusted sources, configure AI, and control integrations with an audit-friendly admin surface.</p>
        </div>
        <div className="manage-hero__meta">
          <span className="pill">{user.role}</span>
          <span className="pill">{spaces.length} collections</span>
        </div>
      </section>

      {status ? <p className="muted">{status}</p> : null}

      <div className="manage-grid">
        {canEdit ? <PageEditor spaces={spaces} /> : null}

        <section className="panel" id="imports">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Imports</p>
              <h3>Bring documentation into Ledger</h3>
            </div>
          </div>
          <div className="field-grid">
            <label className="field">
              Target collection
              <select value={importTarget.spaceId} onChange={(event) => setImportTarget((current) => ({ ...current, spaceId: event.target.value }))}>
                {spaces.map((space) => (
                  <option key={space.id} value={space.id}>
                    {space.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              State
              <select value={importTarget.state} onChange={(event) => setImportTarget((current) => ({ ...current, state: event.target.value }))}>
                <option value="draft">Draft</option>
                <option value="published">Published</option>
              </select>
            </label>
          </div>
          <div className="field-grid">
            <label className="field">
              Visibility
              <select value={importTarget.visibility} onChange={(event) => setImportTarget((current) => ({ ...current, visibility: event.target.value }))}>
                <option value="internal">Internal</option>
                <option value="public">Public</option>
                <option value="restricted">Restricted</option>
              </select>
            </label>
            <div className="field field-note">
              Browser note
              <p className="muted">Ledger supports multiple Markdown files in the browser. Folder upload support depends on the browser, so multiple-file import is the reliable default.</p>
            </div>
          </div>

          <div className="import-grid">
            <section className="subpanel">
              <h4>Markdown</h4>
              <input type="file" accept=".md,.markdown,text/markdown" multiple onChange={(event) => void handleMarkdownFiles(event.target.files)} />
              {markdownPreview ? (
                <div className="preview-list">
                  {markdownPreview.map((document) => (
                    <div key={document.title} className="preview-item">
                      <strong>{document.title}</strong>
                      <p>{document.excerpt ?? "No excerpt available."}</p>
                    </div>
                  ))}
                  <button onClick={runMarkdownImport}>Import Markdown</button>
                </div>
              ) : null}
            </section>

            <section className="subpanel">
              <h4>GitHub</h4>
              <label className="field">
                Repository
                <input value={githubImport.repo} onChange={(event) => setGithubImport((current) => ({ ...current, repo: event.target.value }))} placeholder="org/repo" />
              </label>
              <div className="field-grid">
                <label className="field">
                  Branch
                  <input value={githubImport.branch} onChange={(event) => setGithubImport((current) => ({ ...current, branch: event.target.value }))} />
                </label>
                <label className="field">
                  Path
                  <input value={githubImport.path} onChange={(event) => setGithubImport((current) => ({ ...current, path: event.target.value }))} placeholder="docs/getting-started.md" />
                </label>
              </div>
              <div className="panel__footer">
                <button className="button-secondary" onClick={previewGithubImport}>Preview</button>
                <button onClick={runGithubImport}>Import</button>
              </div>
              {githubPreview ? <div className="preview-item"><strong>{githubPreview.title}</strong><p>{githubPreview.excerpt ?? "No excerpt available."}</p></div> : null}
            </section>

            <section className="subpanel">
              <h4>Google Docs</h4>
              <label className="field">
                Document ID
                <input value={googleImport.documentId} onChange={(event) => setGoogleImport({ documentId: event.target.value })} placeholder="Google Doc ID" />
              </label>
              <div className="panel__footer">
                <button className="button-secondary" onClick={previewGoogleImport}>Preview</button>
                <button onClick={runGoogleImport}>Import</button>
              </div>
              {googlePreview ? <div className="preview-item"><strong>{googlePreview.title}</strong><p>{googlePreview.excerpt ?? "No excerpt available."}</p></div> : null}
            </section>
          </div>
        </section>

        {canAdmin ? (
          <>
            <section className="panel" id="settings">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Branding</p>
                  <h3>Workspace settings</h3>
                </div>
              </div>
              <label className="field">
                Site name
                <input value={brandingForm.siteName} onChange={(event) => setBrandingForm((current) => ({ ...current, siteName: event.target.value }))} />
              </label>
              <div className="field-grid">
                <label className="field">
                  Brand color
                  <input value={brandingForm.brandColor} onChange={(event) => setBrandingForm((current) => ({ ...current, brandColor: event.target.value }))} />
                </label>
                <label className="field">
                  Logo URL
                  <input value={brandingForm.logoUrl} onChange={(event) => setBrandingForm((current) => ({ ...current, logoUrl: event.target.value }))} />
                </label>
              </div>
              <label className="field">
                Footer text
                <input value={brandingForm.footerText} onChange={(event) => setBrandingForm((current) => ({ ...current, footerText: event.target.value }))} />
              </label>
              <label className="checkbox-row checkbox-card">
                <input type="checkbox" checked={brandingForm.publicKnowledgeBaseEnabled} onChange={(event) => setBrandingForm((current) => ({ ...current, publicKnowledgeBaseEnabled: event.target.checked }))} />
                <span>Public knowledge base enabled</span>
              </label>
              <div className="panel__footer">
                <button onClick={saveBranding}>Save settings</button>
              </div>
            </section>

            <section className="panel" id="integrations">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Integrations</p>
                  <h3>Provider configuration</h3>
                </div>
              </div>
              <div className="integration-list">
                {(["github", "google_docs", "markdown_import"] as const).map((provider) => {
                  const currentIntegration = integrations.find((integration) => integration.provider === provider);
                  const form = integrationForms[provider];
                  return (
                    <div key={provider} className="integration-card">
                      <div className="feedback-item__header">
                        <strong>{provider.replace("_", " ")}</strong>
                        <span className={`badge badge-${currentIntegration?.status === "configured" ? "public" : "restricted"}`}>
                          {currentIntegration?.statusMessage ?? "Not configured"}
                        </span>
                      </div>
                      <label className="field">
                        Name
                        <input value={form.name} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], name: event.target.value } }))} />
                      </label>
                      {provider === "github" ? (
                        <label className="field">
                          GitHub token
                          <input type="password" value={form.token} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], token: event.target.value } }))} />
                        </label>
                      ) : null}
                      {provider === "google_docs" ? (
                        <label className="field">
                          Google access token
                          <input type="password" value={form.accessToken} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], accessToken: event.target.value } }))} />
                        </label>
                      ) : null}
                      <label className="checkbox-row checkbox-card">
                        <input type="checkbox" checked={form.isEnabled} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], isEnabled: event.target.checked } }))} />
                        <span>Enable {provider.replace("_", " ")}</span>
                      </label>
                      <div className="panel__footer">
                        <button onClick={() => saveIntegration(provider)}>Save integration</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="panel" id="webhooks">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Webhooks</p>
                  <h3>Signed event delivery</h3>
                </div>
              </div>
              <div className="field-grid">
                <label className="field">
                  Name
                  <input value={webhookForm.name} onChange={(event) => setWebhookForm((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label className="field">
                  Target URL
                  <input value={webhookForm.targetUrl} onChange={(event) => setWebhookForm((current) => ({ ...current, targetUrl: event.target.value }))} />
                </label>
              </div>
              <label className="field">
                Signing secret
                <input value={webhookForm.signingSecret} onChange={(event) => setWebhookForm((current) => ({ ...current, signingSecret: event.target.value }))} />
              </label>
              <label className="field">
                Events
                <input value={webhookForm.events} onChange={(event) => setWebhookForm((current) => ({ ...current, events: event.target.value }))} />
              </label>
              <label className="checkbox-row checkbox-card">
                <input type="checkbox" checked={webhookForm.isActive} onChange={(event) => setWebhookForm((current) => ({ ...current, isActive: event.target.checked }))} />
                <span>Active</span>
              </label>
              <p className="muted">Ledger signs `timestamp.body` with HMAC SHA-256 and sends `X-Ledger-Event`, `X-Ledger-Timestamp`, and `X-Ledger-Signature` headers.</p>
              <div className="panel__footer">
                <button onClick={createWebhook}>Create webhook</button>
              </div>
              <div className="feedback-list">
                {webhooks.map((webhook) => (
                  <div key={webhook.id} className="feedback-item">
                    <div className="feedback-item__header">
                      <strong>{webhook.name}</strong>
                      <span className={`badge badge-${webhook.isActive ? "public" : "restricted"}`}>{webhook.isActive ? "Active" : "Disabled"}</span>
                    </div>
                    <p>{webhook.targetUrl}</p>
                    <p className="muted">{webhook.events.join(", ")}</p>
                    <div className="panel__footer">
                      <button className="button-secondary" onClick={() => loadDeliveries(webhook.id)}>Load deliveries</button>
                      <button className="button-secondary" onClick={() => deleteWebhook(webhook.id)}>Delete</button>
                    </div>
                    {deliveries[webhook.id]?.length ? (
                      <div className="delivery-list">
                        {deliveries[webhook.id].map((delivery) => (
                          <div key={delivery.id} className="delivery-item">
                            <strong>{delivery.eventName}</strong>
                            <span>{delivery.responseStatus ?? "pending"}</span>
                            <span>{delivery.success ? "Success" : delivery.errorMessage ?? "Failed"}</span>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </section>

            <section className="panel" id="ai">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">AI settings</p>
                  <h3>Permissions-aware answers</h3>
                </div>
              </div>
              <div className="field-grid">
                <label className="field">
                  Provider
                  <select value={aiSettings.provider} onChange={(event) => setAiSettings((current) => ({ ...current, provider: event.target.value }))}>
                    <option value="none">Disabled</option>
                    <option value="openai_compatible">OpenAI-compatible</option>
                    <option value="anthropic_compatible">Anthropic-compatible</option>
                  </select>
                </label>
                <label className="field">
                  Model
                  <input value={aiSettings.model} onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))} />
                </label>
              </div>
              <label className="field">
                API key
                <input type="password" value={aiSettings.apiKey} onChange={(event) => setAiSettings((current) => ({ ...current, apiKey: event.target.value }))} placeholder={aiSettings.hasApiKey ? "Configured. Enter a new key to rotate it." : "Paste provider API key"} />
              </label>
              <label className="checkbox-row checkbox-card">
                <input type="checkbox" checked={aiSettings.isEnabled} onChange={(event) => setAiSettings((current) => ({ ...current, isEnabled: event.target.checked }))} />
                <span>Enable AI answers</span>
              </label>
              <p className="muted">AI uses the same page visibility rules as search and document reads, so restricted content is never exposed to the wrong user.</p>
              <div className="panel__footer">
                <button onClick={saveAi}>Save AI settings</button>
              </div>
            </section>

            <section className="panel" id="mcp">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">MCP</p>
                  <h3>Ledger MCP server</h3>
                </div>
              </div>
              <p className="muted">Endpoint: `/api/mcp`</p>
              <p className="muted">Tools: `search_knowledge_base`, `read_page`, `list_spaces`, `get_page_metadata`, `create_draft_page`</p>
              <p className="muted">Auth: same session context as the web app.</p>
            </section>

            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Import history</p>
                  <h3>Recent jobs</h3>
                </div>
              </div>
              <div className="feedback-list">
                {importJobs.map((job) => (
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
            </section>

            {analytics ? (
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">Analytics</p>
                    <h3>Search performance</h3>
                  </div>
                </div>
                <div className="analytics-grid">
                  <div>
                    <strong>Top searches</strong>
                    {analytics.topSearches.map((item) => (
                      <p key={item.query}>{item.query} <span className="muted">({item.count})</span></p>
                    ))}
                  </div>
                  <div>
                    <strong>No results</strong>
                    {analytics.noResults.map((item) => (
                      <p key={item.query}>{item.query} <span className="muted">({item.count})</span></p>
                    ))}
                  </div>
                </div>
              </section>
            ) : null}

            {feedback ? (
              <section className="panel">
                <div className="panel__header">
                  <div>
                    <p className="eyebrow">Feedback queue</p>
                    <h3>Reader responses</h3>
                  </div>
                </div>
                <div className="feedback-list">
                  {feedback.map((item) => (
                    <div key={item.id} className="feedback-item">
                      <div className="feedback-item__header">
                        <strong>{item.page_title}</strong>
                        <span className={`badge ${item.helpful ? "badge-public" : "badge-restricted"}`}>
                          {item.helpful ? "Helpful" : "Not helpful"}
                        </span>
                      </div>
                      <p>{item.comment ?? "No comment provided."}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </div>
  );
}
