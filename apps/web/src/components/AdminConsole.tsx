import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import type {
  ImportJobSummary,
  IntegrationSummary,
  SessionUser,
  WebhookDeliverySummary,
  WebhookSummary
} from "@ledger/shared";
import { api } from "../lib/api";
import { EmptyState } from "./EmptyState";
import { PageEditor } from "./PageEditor";
import { PageHeader } from "./PageHeader";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

type AdminUser = { id: string; email: string; display_name: string; role_key: string };
type AdminGroup = { id: string; name: string; description: string | null };
type ActivityItem = {
  id: string;
  action: string;
  resource_type: string;
  resource_id: string;
  actor_name: string;
  created_at: string;
};

const adminNav = [
  ["general", "General"],
  ["members", "Members"],
  ["permissions", "Permissions"],
  ["integrations", "Integrations"],
  ["webhooks", "Webhooks"],
  ["ai", "AI Settings"],
  ["mcp", "MCP"],
  ["import-history", "Import History"],
  ["activity", "Activity"]
] as const;

const webhookEvents = [
  "page.created",
  "page.updated",
  "page.deleted",
  "page.published",
  "feedback.created",
  "user.invited",
  "search.no_results"
] as const;

export function AdminConsole({ user, spaces }: { user: SessionUser; spaces: Space[] }) {
  const { section = "general" } = useParams();
  const currentSection = adminNav.some(([key]) => key === section) ? section : "general";
  const [brandingForm, setBrandingForm] = useState({
    siteName: "Ledger",
    logoUrl: "",
    brandColor: "#245cff",
    footerText: "",
    publicKnowledgeBaseEnabled: true
  });
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [groups, setGroups] = useState<AdminGroup[]>([]);
  const [roles, setRoles] = useState<Array<{ id: string; key: string; name: string }>>([]);
  const [integrations, setIntegrations] = useState<IntegrationSummary[]>([]);
  const [importJobs, setImportJobs] = useState<ImportJobSummary[]>([]);
  const [webhooks, setWebhooks] = useState<WebhookSummary[]>([]);
  const [deliveries, setDeliveries] = useState<Record<string, WebhookDeliverySummary[]>>({});
  const [activity, setActivity] = useState<ActivityItem[]>([]);
  const [aiSettings, setAiSettings] = useState({
    provider: "none",
    model: "",
    isEnabled: false,
    hasApiKey: false,
    apiKey: ""
  });
  const [integrationForms, setIntegrationForms] = useState<Record<string, { name: string; isEnabled: boolean; token: string; accessToken: string }>>({
    github: { name: "GitHub", isEnabled: false, token: "", accessToken: "" },
    google_docs: { name: "Google Docs", isEnabled: false, token: "", accessToken: "" },
    markdown_import: { name: "Markdown Import", isEnabled: true, token: "", accessToken: "" }
  });
  const [editingWebhookId, setEditingWebhookId] = useState<string | null>(null);
  const [webhookForm, setWebhookForm] = useState({
    name: "",
    targetUrl: "",
    signingSecret: "",
    isActive: true,
    events: ["page.created", "page.updated"] as string[]
  });
  const [status, setStatus] = useState<string | null>(null);

  const currentWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.id === editingWebhookId) ?? null,
    [editingWebhookId, webhooks]
  );

  useEffect(() => {
    async function load() {
      const [usersResponse, groupsResponse, rolesResponse, settingsResponse, integrationsResponse, jobsResponse, aiResponse, webhooksResponse, activityResponse] =
        await Promise.all([
          api.get<{ users: AdminUser[] }>("/api/admin/users"),
          api.get<{ groups: AdminGroup[] }>("/api/admin/groups"),
          api.get<{ roles: Array<{ id: string; key: string; name: string }> }>("/api/roles"),
          api.get<{
            branding: { site_name: string; logo_url: string | null; brand_color: string; footer_text: string | null; public_knowledge_base_enabled: boolean };
            mcp: { endpoint: string; authMode: string };
          }>("/api/settings/admin"),
          api.get<{ integrations: IntegrationSummary[] }>("/api/integrations"),
          api.get<{ jobs: ImportJobSummary[] }>("/api/integrations/import-jobs"),
          api.get<{ settings: { provider: string; model: string; isEnabled: boolean; hasApiKey: boolean } }>("/api/ai/settings"),
          api.get<{ webhooks: WebhookSummary[] }>("/api/webhooks"),
          api.get<{ activity: ActivityItem[] }>("/api/admin/activity")
        ]);

      setUsers(usersResponse.users);
      setGroups(groupsResponse.groups);
      setRoles(rolesResponse.roles);
      setBrandingForm({
        siteName: settingsResponse.branding.site_name,
        logoUrl: settingsResponse.branding.logo_url ?? "",
        brandColor: settingsResponse.branding.brand_color,
        footerText: settingsResponse.branding.footer_text ?? "",
        publicKnowledgeBaseEnabled: settingsResponse.branding.public_knowledge_base_enabled
      });
      setIntegrations(integrationsResponse.integrations);
      setImportJobs(jobsResponse.jobs);
      setAiSettings((current) => ({ ...current, ...aiResponse.settings, apiKey: "" }));
      setWebhooks(webhooksResponse.webhooks);
      setActivity(activityResponse.activity);
      setIntegrationForms((current) => {
        const next = { ...current };
        for (const integration of integrationsResponse.integrations) {
          next[integration.provider] = {
            name: integration.name,
            isEnabled: integration.isEnabled,
            token: "",
            accessToken: ""
          };
        }
        return next;
      });
    }

    void load();
  }, []);

  useEffect(() => {
    if (!currentWebhook) {
      setWebhookForm({
        name: "",
        targetUrl: "",
        signingSecret: "",
        isActive: true,
        events: ["page.created", "page.updated"]
      });
      return;
    }

      setWebhookForm({
        name: currentWebhook.name,
        targetUrl: currentWebhook.targetUrl,
        signingSecret: "",
        isActive: currentWebhook.isActive,
        events: currentWebhook.events
      });
  }, [currentWebhook]);

  async function refreshWebhooks() {
    const response = await api.get<{ webhooks: WebhookSummary[] }>("/api/webhooks");
    setWebhooks(response.webhooks);
  }

  async function refreshIntegrations() {
    const [integrationsResponse, jobsResponse] = await Promise.all([
      api.get<{ integrations: IntegrationSummary[] }>("/api/integrations"),
      api.get<{ jobs: ImportJobSummary[] }>("/api/integrations/import-jobs")
    ]);
    setIntegrations(integrationsResponse.integrations);
    setImportJobs(jobsResponse.jobs);
  }

  async function saveBranding() {
    try {
      await api.put("/api/settings/branding", {
        siteName: brandingForm.siteName,
        logoUrl: brandingForm.logoUrl || null,
        brandColor: brandingForm.brandColor,
        footerText: brandingForm.footerText || null,
        publicKnowledgeBaseEnabled: brandingForm.publicKnowledgeBaseEnabled
      });
      setStatus("General settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save general settings.");
    }
  }

  async function saveIntegration(provider: "github" | "google_docs" | "markdown_import") {
    try {
      const form = integrationForms[provider];
      await api.put(`/api/integrations/${provider}`, {
        name: form.name,
        isEnabled: form.isEnabled,
        config:
          provider === "github"
            ? { token: form.token }
            : provider === "google_docs"
              ? { accessToken: form.accessToken }
              : {}
      });
      await refreshIntegrations();
      setStatus(`${provider.replace("_", " ")} settings saved.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save integration settings.");
    }
  }

  async function saveWebhook() {
    try {
      const payload = {
        ...webhookForm,
        events: webhookForm.events
      };

      if (editingWebhookId) {
        await api.put(`/api/webhooks/${editingWebhookId}`, payload);
        setStatus("Webhook updated.");
      } else {
        await api.post("/api/webhooks", payload);
        setStatus("Webhook created.");
      }

      setEditingWebhookId(null);
      await refreshWebhooks();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save webhook.");
    }
  }

  async function deleteWebhook(webhookId: string) {
    if (!window.confirm("Delete this webhook?")) return;
    try {
      await api.delete(`/api/webhooks/${webhookId}`);
      await refreshWebhooks();
      setStatus("Webhook deleted.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not delete webhook.");
    }
  }

  async function loadDeliveries(webhookId: string) {
    try {
      const response = await api.get<{ deliveries: WebhookDeliverySummary[] }>(`/api/webhooks/${webhookId}/deliveries`);
      setDeliveries((current) => ({ ...current, [webhookId]: response.deliveries }));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not load deliveries.");
    }
  }

  async function testWebhook(webhookId: string) {
    try {
      await api.post(`/api/webhooks/${webhookId}/test`);
      setStatus("Test webhook queued.");
      await loadDeliveries(webhookId);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not queue test webhook.");
    }
  }

  async function saveAi() {
    try {
      await api.put("/api/ai/settings", {
        provider: aiSettings.provider,
        model: aiSettings.model,
        apiKey: aiSettings.apiKey || null,
        isEnabled: aiSettings.isEnabled
      });
      setStatus("AI settings saved.");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not save AI settings.");
    }
  }

  function sectionMeta() {
    switch (currentSection) {
      case "general":
        return ["Admin", "General settings", "Manage workspace branding, public visibility, and core document publishing."];
      case "members":
        return ["Admin", "Members", "Review who has access to Ledger and how groups are organized."];
      case "permissions":
        return ["Admin", "Permissions", "Review role capabilities and how restricted pages are enforced."];
      case "integrations":
        return ["Admin", "Integrations", "Configure source systems and send people into the import workflow when the connector is ready."];
      case "webhooks":
        return ["Admin", "Webhooks", "Manage outbound event delivery, signing secrets, and recent delivery attempts."];
      case "ai":
        return ["Admin", "AI Settings", "Configure AI providers and review how retrieval and citations behave."];
      case "mcp":
        return ["Admin", "MCP", "Inspect Ledger’s MCP surface and understand how auth and permissions apply."];
      case "import-history":
        return ["Admin", "Import history", "Review import jobs, status, and outcomes."];
      case "activity":
        return ["Admin", "Activity", "Review recent audit activity across the workspace."];
      default:
        return ["Admin", "Admin", ""];
    }
  }

  const [eyebrow, title, description] = sectionMeta();

  return (
    <div className="admin-shell">
      <aside className="admin-sidebar panel">
        <div className="panel__header">
          <div>
            <p className="eyebrow">Admin</p>
            <h3>Workspace controls</h3>
          </div>
        </div>
        <nav className="admin-nav">
          {adminNav.map(([key, label]) => (
            <Link key={key} to={`/admin/${key}`} className={`admin-nav__item${currentSection === key ? " is-current" : ""}`}>
              {label}
            </Link>
          ))}
        </nav>
      </aside>

      <div className="admin-content stack-page">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        {status ? <p className="muted">{status}</p> : null}

        {currentSection === "general" ? (
          <>
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Branding</p>
                  <h3>Workspace identity</h3>
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
                <button onClick={saveBranding}>Save general settings</button>
              </div>
            </section>
            <PageEditor spaces={spaces} />
          </>
        ) : null}

        {currentSection === "members" ? (
          <div className="admin-grid">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Users</p>
                  <h3>Members</h3>
                </div>
              </div>
              <div className="list-grid">
                {users.map((member) => (
                  <div key={member.id} className="list-item">
                    <strong>{member.display_name}</strong>
                    <span>{member.email}</span>
                    <span className="badge badge-internal">{member.role_key}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Groups</p>
                  <h3>Permission groups</h3>
                </div>
              </div>
              {groups.length === 0 ? (
                <EmptyState title="No groups yet" description="Create groups in the backend or seed data to organize restricted pages by team." />
              ) : (
                <div className="list-grid">
                  {groups.map((group) => (
                    <div key={group.id} className="list-item">
                      <strong>{group.name}</strong>
                      <span>{group.description ?? "No description"}</span>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </div>
        ) : null}

        {currentSection === "permissions" ? (
          <div className="admin-grid">
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Roles</p>
                  <h3>Access levels</h3>
                </div>
              </div>
              <div className="list-grid">
                {roles.map((role) => (
                  <div key={role.id} className="list-item">
                    <strong>{role.name}</strong>
                    <span>{role.key}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Behavior</p>
                  <h3>Permission model</h3>
                </div>
              </div>
              <div className="list-grid">
                <div className="list-item">
                  <strong>Public pages</strong>
                  <span>Readable without authentication when public KB is enabled.</span>
                </div>
                <div className="list-item">
                  <strong>Internal pages</strong>
                  <span>Readable only by authenticated users with at least viewer access.</span>
                </div>
                <div className="list-item">
                  <strong>Restricted pages</strong>
                  <span>Require explicit role or group permissions. Search, AI, and MCP follow the same backend checks.</span>
                </div>
              </div>
            </section>
          </div>
        ) : null}

        {currentSection === "integrations" ? (
          <section className="integration-list">
            {(["google_docs", "github", "markdown_import"] as const).map((provider) => {
              const integration = integrations.find((item) => item.provider === provider);
              const lastJob = importJobs.find((job) => job.provider === provider);
              const form = integrationForms[provider];
              const canRunImport = provider === "markdown_import" || integration?.status === "configured";
              return (
                <section key={provider} className="integration-card panel">
                  <div className="panel__header">
                    <div>
                      <p className="eyebrow">Integration</p>
                      <h3>{provider === "google_docs" ? "Google Docs" : provider === "github" ? "GitHub" : "Markdown Import"}</h3>
                    </div>
                    <span className={`badge badge-${integration?.status === "configured" ? "public" : "restricted"}`}>
                      {integration?.statusMessage ?? "Not configured"}
                    </span>
                  </div>
                  <p className="muted">
                    {provider === "google_docs"
                      ? "Import Google Docs content into Ledger pages."
                      : provider === "github"
                        ? "Import Markdown files from a repository path."
                        : "Upload Markdown files directly from the browser."}
                  </p>
                  <p className="muted">
                    {lastJob ? `Last import: ${new Date(lastJob.updatedAt).toLocaleString()}` : "Last import: none yet"}
                  </p>
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
                    <span>Enabled</span>
                  </label>
                  <div className="panel__footer">
                    <button onClick={() => saveIntegration(provider)}>Save configuration</button>
                    {canRunImport ? <Link to="/imports" className="button-secondary">Open imports</Link> : <button type="button" className="button-secondary" disabled title="Configure this integration before importing.">Import unavailable</button>}
                  </div>
                </section>
              );
            })}
          </section>
        ) : null}

        {currentSection === "webhooks" ? (
          <>
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Webhook editor</p>
                  <h3>{editingWebhookId ? "Edit webhook" : "Create webhook"}</h3>
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
                <input value={webhookForm.signingSecret} onChange={(event) => setWebhookForm((current) => ({ ...current, signingSecret: event.target.value }))} placeholder={editingWebhookId ? "Enter a new secret to rotate it." : "Required"} />
              </label>
              <label className="field">
                Event checklist
                <div className="checkbox-list">
                  {webhookEvents.map((eventName) => (
                    <label key={eventName} className="checkbox-row checkbox-card">
                      <input
                        type="checkbox"
                        checked={webhookForm.events.includes(eventName)}
                        onChange={(event) =>
                          setWebhookForm((current) => ({
                            ...current,
                            events: event.target.checked
                              ? [...current.events, eventName]
                              : current.events.filter((value) => value !== eventName)
                          }))
                        }
                      />
                      <span>{eventName}</span>
                    </label>
                  ))}
                </div>
              </label>
              <label className="checkbox-row checkbox-card">
                <input type="checkbox" checked={webhookForm.isActive} onChange={(event) => setWebhookForm((current) => ({ ...current, isActive: event.target.checked }))} />
                <span>Active</span>
              </label>
              <p className="muted">Ledger sends `X-Ledger-Event`, `X-Ledger-Timestamp`, and `X-Ledger-Signature` headers. The signature is HMAC SHA-256 over `timestamp.body`.</p>
              <div className="panel__footer">
                <button onClick={saveWebhook}>{editingWebhookId ? "Save webhook" : "Create webhook"}</button>
                {editingWebhookId ? <button type="button" className="button-secondary" onClick={() => setEditingWebhookId(null)}>Cancel edit</button> : null}
              </div>
            </section>
            <section className="panel">
              <div className="panel__header">
                <div>
                  <p className="eyebrow">Configured endpoints</p>
                  <h3>Webhook endpoints</h3>
                </div>
              </div>
              {webhooks.length === 0 ? (
                <EmptyState title="No webhooks configured" description="Create a webhook to deliver Ledger events to another system." />
              ) : (
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
                        <button type="button" className="button-secondary" onClick={() => setEditingWebhookId(webhook.id)}>Edit</button>
                        <button type="button" className="button-secondary" onClick={() => loadDeliveries(webhook.id)}>View deliveries</button>
                        <button type="button" className="button-secondary" onClick={() => testWebhook(webhook.id)}>Test webhook</button>
                        <button type="button" className="button-secondary" onClick={() => deleteWebhook(webhook.id)}>Delete</button>
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
              )}
            </section>
          </>
        ) : null}

        {currentSection === "ai" ? (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Provider configuration</p>
                <h3>AI settings</h3>
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
              <input type="password" value={aiSettings.apiKey} onChange={(event) => setAiSettings((current) => ({ ...current, apiKey: event.target.value }))} placeholder={aiSettings.hasApiKey ? "Configured. Enter a new key to rotate it." : "Paste provider key"} />
            </label>
            <label className="checkbox-row checkbox-card">
              <input type="checkbox" checked={aiSettings.isEnabled} onChange={(event) => setAiSettings((current) => ({ ...current, isEnabled: event.target.checked }))} />
              <span>Enable AI answers</span>
            </label>
            <div className="admin-grid">
              <div className="list-item">
                <strong>Retrieval settings</strong>
                <span>Ledger uses permission-filtered keyword retrieval over permitted pages. This is active whenever AI is enabled.</span>
              </div>
              <div className="list-item">
                <strong>Answer behavior</strong>
                <span>Answers should refuse when the KB lacks enough information instead of fabricating a response.</span>
              </div>
              <div className="list-item">
                <strong>Citation behavior</strong>
                <span>Every answer links back to source pages the user can already access.</span>
              </div>
            </div>
            {aiSettings.provider === "none" || !aiSettings.isEnabled ? (
              <EmptyState title="AI is disabled" description="Ask AI will remain available as a page, but the primary action stays disabled until a provider is configured." />
            ) : null}
            <div className="panel__footer">
              <button onClick={saveAi}>Save AI settings</button>
            </div>
          </section>
        ) : null}

        {currentSection === "mcp" ? (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Server status</p>
                <h3>MCP availability</h3>
              </div>
            </div>
            <div className="list-grid">
              <div className="list-item">
                <strong>Status</strong>
                <span>MCP is exposed at `/api/mcp` through the same backend service as the application.</span>
              </div>
              <div className="list-item">
                <strong>Tools</strong>
                <span>`search_knowledge_base`, `read_page`, `list_spaces`, `get_page_metadata`, `create_draft_page`</span>
              </div>
              <div className="list-item">
                <strong>Auth</strong>
                <span>MCP currently uses the active Ledger session. Dedicated API tokens are not implemented, so the UI does not claim otherwise.</span>
              </div>
              <div className="list-item">
                <strong>Permission behavior</strong>
                <span>MCP calls inherit the same backend visibility checks as page reads, search, and AI retrieval.</span>
              </div>
            </div>
          </section>
        ) : null}

        {currentSection === "import-history" ? (
          <section className="panel">
            {importJobs.length === 0 ? (
              <EmptyState title="No imports yet" description="Run an import from the Imports area to populate this history." />
            ) : (
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
            )}
          </section>
        ) : null}

        {currentSection === "activity" ? (
          <section className="panel">
            {activity.length === 0 ? (
              <EmptyState title="No activity logged" description="Recent audit activity will appear here as users change content and settings." />
            ) : (
              <div className="list-grid">
                {activity.map((item) => (
                  <div key={item.id} className="list-item">
                    <strong>{item.action}</strong>
                    <span>{item.actor_name} • {new Date(item.created_at).toLocaleString()}</span>
                    <span>{item.resource_type}:{item.resource_id}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        ) : null}
      </div>
    </div>
  );
}
