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
import { resolveDisplayedMcpEndpoint } from "../lib/mcp";
import { EmptyState } from "./EmptyState";
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
  ["ai", "AI & MCP"],
  ["import-history", "Import"],
  ["activity", "Activity"]
] as const;

const adminGroups = [
  {
    label: "Workspace",
    items: [
      ["general", "General"],
      ["members", "Members"],
      ["permissions", "Permissions"]
    ]
  },
  {
    label: "Platform",
    items: [
      ["integrations", "Integrations"],
      ["webhooks", "Webhooks"],
      ["ai", "AI & MCP"],
      ["import-history", "Import"],
      ["activity", "Activity"]
    ]
  }
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

const roleDetails: Record<string, string> = {
  owner: "Full control over settings, members, content, and infrastructure features.",
  admin: "Manage workspace configuration, members, imports, integrations, and webhook behavior.",
  editor: "Create and update documents, drafts, and import content where enabled.",
  viewer: "Read internal content that is available to authenticated members.",
  public: "Read only public content without signing in."
};

export function AdminConsole({ user: _user, spaces: _spaces }: { user: SessionUser; spaces: Space[] }) {
  const { section = "general" } = useParams();
  const normalizedSection = section === "mcp" ? "ai" : section;
  const currentSection = adminNav.some(([key]) => key === normalizedSection) ? normalizedSection : "general";
  const [brandingForm, setBrandingForm] = useState({
    siteName: "Ledger",
    logoUrl: "",
    brandColor: "#245cff",
    publicKnowledgeBaseEnabled: true,
    footerLinks: [] as Array<{ label: string; href: string }>
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
  const [mcpSettings, setMcpSettings] = useState({
    endpoint: "/mcp",
    authMode: "session_cookie"
  });

  const currentWebhook = useMemo(
    () => webhooks.find((webhook) => webhook.id === editingWebhookId) ?? null,
    [editingWebhookId, webhooks]
  );
  const displayedMcpEndpoint = useMemo(
    () => resolveDisplayedMcpEndpoint(mcpSettings.endpoint),
    [mcpSettings.endpoint]
  );

  useEffect(() => {
    async function load() {
      const [usersResponse, groupsResponse, rolesResponse, settingsResponse, integrationsResponse, jobsResponse, aiResponse, webhooksResponse, activityResponse] =
        await Promise.all([
          api.get<{ users: AdminUser[] }>("/api/admin/users"),
          api.get<{ groups: AdminGroup[] }>("/api/admin/groups"),
          api.get<{ roles: Array<{ id: string; key: string; name: string }> }>("/api/roles"),
          api.get<{
            branding: { site_name: string; logo_url: string | null; brand_color: string; footer_text: string | null; public_knowledge_base_enabled: boolean; footer_links: Array<{ label: string; href: string }> };
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
        publicKnowledgeBaseEnabled: settingsResponse.branding.public_knowledge_base_enabled,
        footerLinks: settingsResponse.branding.footer_links ?? []
      });
      setMcpSettings(settingsResponse.mcp);
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
        publicKnowledgeBaseEnabled: brandingForm.publicKnowledgeBaseEnabled,
        footerLinks: brandingForm.footerLinks.filter((link) => link.label.trim() && link.href.trim())
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
        return ["Admin", "Integrations", "Configure source systems, check connector health, and jump into importing content."];
      case "webhooks":
        return ["Admin", "Webhooks", "Manage outbound event delivery, signing secrets, and recent delivery attempts."];
      case "ai":
        return ["Admin", "AI & MCP", "Configure AI providers, review answer behavior, and inspect the MCP surface exposed by Ledger."];
      case "import-history":
        return ["Admin", "Import", "Launch imports and review recent import activity from one place."];
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
        <Link to="/spaces" className="admin-backlink">Back to app</Link>
        <div className="panel__header">
          <div>
            <p className="eyebrow">Admin</p>
            <h3>Workspace controls</h3>
          </div>
        </div>
        {adminGroups.map((group) => (
          <div key={group.label} className="admin-nav-group">
            <p className="admin-nav-group__label">{group.label}</p>
            <nav className="admin-nav">
              {group.items.map(([key, label]) => (
                <Link key={key} to={`/admin/${key}`} className={`admin-nav__item${currentSection === key ? " is-current" : ""}`}>
                  {label}
                </Link>
              ))}
            </nav>
          </div>
        ))}
      </aside>

      <div className="admin-content stack-page">
        <PageHeader eyebrow={eyebrow} title={title} description={description} />
        {status ? <p className="muted">{status}</p> : null}

        {currentSection === "general" ? (
          <>
            <section className="settings-section">
              <h2 className="settings-section__title">Workspace</h2>

              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Site name</strong>
                  <p>Name shown across the workspace and navigation.</p>
                </div>
                <div className="settings-row__control">
                  <input value={brandingForm.siteName} onChange={(event) => setBrandingForm((current) => ({ ...current, siteName: event.target.value }))} />
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Logo URL</strong>
                  <p>Optional logo used in the workspace header.</p>
                </div>
                <div className="settings-row__control">
                  <input value={brandingForm.logoUrl} onChange={(event) => setBrandingForm((current) => ({ ...current, logoUrl: event.target.value }))} />
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Brand color</strong>
                  <p>Primary accent used for actions and highlights.</p>
                </div>
                <div className="settings-row__control">
                  <input value={brandingForm.brandColor} onChange={(event) => setBrandingForm((current) => ({ ...current, brandColor: event.target.value }))} />
                </div>
              </div>

              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Public knowledge base</strong>
                  <p>Allow public visitors to read public pages without signing in.</p>
                </div>
                <label className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={brandingForm.publicKnowledgeBaseEnabled}
                    onChange={(event) => setBrandingForm((current) => ({ ...current, publicKnowledgeBaseEnabled: event.target.checked }))}
                  />
                  <span className="toggle-switch__track" />
                </label>
              </div>

                <div className="settings-row">
                  <div className="settings-row__content">
                    <strong>Footer links</strong>
                    <p>Add support, status, or policy links beside the fixed Ledger footer line.</p>
                  </div>
                  <div className="settings-row__control settings-row__control-stack">
                    {brandingForm.footerLinks.length === 0 ? <p className="muted">No footer links configured yet.</p> : null}
                    {brandingForm.footerLinks.map((link, index) => (
                      <div key={`${link.label}-${index}`} className="settings-inline-grid">
                        <input
                          value={link.label}
                          placeholder="Label"
                          onChange={(event) =>
                            setBrandingForm((current) => ({
                              ...current,
                              footerLinks: current.footerLinks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, label: event.target.value } : item
                              )
                            }))
                          }
                        />
                        <input
                          value={link.href}
                          placeholder="https://example.com"
                          onChange={(event) =>
                            setBrandingForm((current) => ({
                              ...current,
                              footerLinks: current.footerLinks.map((item, itemIndex) =>
                                itemIndex === index ? { ...item, href: event.target.value } : item
                              )
                            }))
                          }
                        />
                        <button
                          type="button"
                          className="button-secondary"
                          onClick={() =>
                            setBrandingForm((current) => ({
                              ...current,
                              footerLinks: current.footerLinks.filter((_, itemIndex) => itemIndex !== index)
                            }))
                          }
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                    <button
                      type="button"
                      className="button-secondary"
                      onClick={() =>
                        setBrandingForm((current) => ({
                          ...current,
                          footerLinks: [...current.footerLinks, { label: "", href: "" }]
                        }))
                      }
                    >
                      Add footer link
                    </button>
                  </div>
                </div>
            </section>

            <div className="settings-actions">
              <button onClick={saveBranding}>Save general settings</button>
            </div>
          </>
        ) : null}

        {currentSection === "members" ? (
          <>
            <section className="settings-section">
              <h2 className="settings-section__title">Members</h2>
              <div className="settings-row settings-row--summary">
                <div className="settings-row__content">
                  <strong>Workspace access</strong>
                  <p>Members are listed here with their current effective role so admins can quickly verify who can browse, edit, and manage the knowledge base.</p>
                </div>
                <div className="settings-row__value">{users.length} members</div>
              </div>
              {users.map((member) => (
                <div key={member.id} className="settings-row">
                  <div className="settings-row__content">
                    <strong>{member.display_name}</strong>
                    <p>{member.email}</p>
                  </div>
                  <div className="settings-row__value">
                    <span className="badge badge-internal">{member.role_key}</span>
                  </div>
                </div>
              ))}
            </section>
            <section className="settings-section settings-section-subtle">
              <h2 className="settings-section__title">Groups</h2>
              {groups.length === 0 ? (
                <EmptyState title="No groups yet" description="Create groups in the backend or seed data to organize restricted pages by team." />
              ) : (
                groups.map((group) => (
                  <div key={group.id} className="settings-row">
                    <div className="settings-row__content">
                      <strong>{group.name}</strong>
                      <p>{group.description ?? "No description"}</p>
                    </div>
                  </div>
                ))
              )}
            </section>
          </>
        ) : null}

        {currentSection === "permissions" ? (
          <>
            <section className="settings-section">
              <h2 className="settings-section__title">Roles</h2>
              {roles.map((role) => (
                <div key={role.id} className="settings-row">
                  <div className="settings-row__content">
                    <strong>{role.name}</strong>
                    <p>{roleDetails[role.key] ?? role.key}</p>
                  </div>
                  <div className="settings-row__value">{role.key}</div>
                </div>
              ))}
            </section>
            <section className="settings-section settings-section-subtle">
              <h2 className="settings-section__title">Permission behavior</h2>
              {[
                ["Public pages", "Readable without authentication when the public knowledge base is enabled."],
                ["Internal pages", "Readable only by authenticated users with at least viewer access."],
                ["Restricted pages", "Require explicit role or group permissions. Search, AI, and MCP follow the same backend checks."]
              ].map(([label, detail]) => (
                <div key={label} className="settings-row">
                  <div className="settings-row__content">
                    <strong>{label}</strong>
                    <p>{detail}</p>
                  </div>
                </div>
              ))}
            </section>
          </>
        ) : null}

        {currentSection === "integrations" ? (
          <section className="integration-list">
            {(["google_docs", "github", "markdown_import"] as const).map((provider) => {
              const integration = integrations.find((item) => item.provider === provider);
              const lastJob = importJobs.find((job) => job.provider === provider);
              const form = integrationForms[provider];
              const canRunImport = provider === "markdown_import" || integration?.status === "configured";
              const integrationTitle = provider === "google_docs" ? "Google Docs" : provider === "github" ? "GitHub" : "Markdown Import";
              const integrationDescription =
                provider === "google_docs"
                  ? "Import Google Docs content into Ledger Markdown pages and preserve source metadata."
                  : provider === "github"
                    ? "Connect a GitHub repository and import Markdown from a chosen branch and path."
                    : "Upload Markdown files directly through Ledger without an external connector.";
              return (
                <section key={provider} className="settings-section settings-section-subtle integration-section">
                  <div className="settings-row settings-row--summary">
                    <div className="settings-row__content">
                      <strong>{integrationTitle}</strong>
                      <p>{integrationDescription}</p>
                    </div>
                    <div className="settings-row__value">
                      <span className={`badge badge-${integration?.status === "configured" ? "public" : "restricted"}`}>
                        {integration?.statusMessage ?? "Not configured"}
                      </span>
                    </div>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <strong>Connection name</strong>
                      <p>Used in the admin UI to identify this source.</p>
                    </div>
                    <div className="settings-row__control">
                      <input value={form.name} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], name: event.target.value } }))} />
                    </div>
                  </div>
                  {provider === "github" ? (
                    <div className="settings-row">
                      <div className="settings-row__content">
                        <strong>GitHub token</strong>
                        <p>Required for repository previews and imports.</p>
                      </div>
                      <div className="settings-row__control">
                        <input type="password" value={form.token} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], token: event.target.value } }))} />
                      </div>
                    </div>
                  ) : null}
                  {provider === "google_docs" ? (
                    <div className="settings-row">
                      <div className="settings-row__content">
                        <strong>Google access token</strong>
                        <p>Required for previewing and importing Google Docs.</p>
                      </div>
                      <div className="settings-row__control">
                        <input type="password" value={form.accessToken} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], accessToken: event.target.value } }))} />
                      </div>
                    </div>
                  ) : null}
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <strong>Enabled</strong>
                      <p>Allow this integration to preview and import content.</p>
                    </div>
                    <label className="toggle-switch">
                      <input type="checkbox" checked={form.isEnabled} onChange={(event) => setIntegrationForms((current) => ({ ...current, [provider]: { ...current[provider], isEnabled: event.target.checked } }))} />
                      <span className="toggle-switch__track" />
                    </label>
                  </div>
                  <div className="settings-row">
                    <div className="settings-row__content">
                      <strong>Last import</strong>
                      <p>Latest import activity for this source.</p>
                    </div>
                    <div className="settings-row__value">{lastJob ? new Date(lastJob.updatedAt).toLocaleString() : "None yet"}</div>
                  </div>
                  <div className="panel__footer panel__footer-start">
                    <button onClick={() => saveIntegration(provider)}>Save configuration</button>
                    {canRunImport ? <Link to="/imports" className="button-secondary">Open import</Link> : <button type="button" className="button-secondary" disabled title="Configure this integration before importing.">Import unavailable</button>}
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
                      <div className="settings-row__content">
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
          <>
            <section className="settings-section">
              <h2 className="settings-section__title">AI provider</h2>
              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Provider</strong>
                  <p>Select the provider type Ledger should use for answers.</p>
                </div>
                <div className="settings-row__control">
                  <select value={aiSettings.provider} onChange={(event) => setAiSettings((current) => ({ ...current, provider: event.target.value }))}>
                    <option value="none">Disabled</option>
                    <option value="openai_compatible">OpenAI-compatible</option>
                    <option value="anthropic_compatible">Anthropic-compatible</option>
                  </select>
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Model</strong>
                  <p>Model identifier used by the configured provider.</p>
                </div>
                <div className="settings-row__control">
                  <input value={aiSettings.model} onChange={(event) => setAiSettings((current) => ({ ...current, model: event.target.value }))} />
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>API key</strong>
                  <p>{aiSettings.hasApiKey ? "A provider key is already stored. Enter a new key to rotate it." : "Paste a provider key to enable server-side requests."}</p>
                </div>
                <div className="settings-row__control">
                  <input type="password" value={aiSettings.apiKey} onChange={(event) => setAiSettings((current) => ({ ...current, apiKey: event.target.value }))} placeholder={aiSettings.hasApiKey ? "Configured" : "Paste provider key"} />
                </div>
              </div>
              <div className="settings-row">
                <div className="settings-row__content">
                  <strong>Enable AI answers</strong>
                  <p>Allow Ask AI to answer from permission-filtered Ledger content.</p>
                </div>
                <label className="toggle-switch">
                  <input type="checkbox" checked={aiSettings.isEnabled} onChange={(event) => setAiSettings((current) => ({ ...current, isEnabled: event.target.checked }))} />
                  <span className="toggle-switch__track" />
                </label>
              </div>
              <div className="settings-row"><div className="settings-row__content"><strong>Retrieval settings</strong><p>Ledger searches only pages the current user can access before generating an answer.</p></div></div>
              <div className="settings-row"><div className="settings-row__content"><strong>Answer behavior</strong><p>If the knowledge base does not contain enough information, Ledger refuses instead of inventing an answer.</p></div></div>
              <div className="settings-row"><div className="settings-row__content"><strong>Citation behavior</strong><p>Answers cite the exact source pages the user is already allowed to open.</p></div></div>
            </section>
            {aiSettings.provider === "none" || !aiSettings.isEnabled ? (
              <EmptyState title="AI is disabled" description="Ask AI will remain available as a page, but the primary action stays disabled until a provider is configured." />
            ) : null}
            <section className="settings-section settings-section-subtle">
              <h2 className="settings-section__title">MCP server</h2>
              <div className="settings-row"><div className="settings-row__content"><strong>Hosted endpoint</strong><p>{displayedMcpEndpoint}</p></div><div className="settings-row__value">Live path</div></div>
              <div className="settings-row"><div className="settings-row__content"><strong>Tools</strong><p><code>search_knowledge_base</code>, <code>read_page</code>, <code>list_spaces</code>, <code>get_page_metadata</code>, <code>create_draft_page</code></p></div></div>
              <div className="settings-row"><div className="settings-row__content"><strong>Auth</strong><p>MCP currently uses {mcpSettings.authMode === "session_cookie" ? "the active Ledger session cookie" : mcpSettings.authMode}. Dedicated API tokens are not implemented yet.</p></div></div>
              <div className="settings-row"><div className="settings-row__content"><strong>Permission behavior</strong><p>MCP calls inherit the same backend visibility checks as page reads, search, and AI retrieval.</p></div></div>
            </section>
            <div className="settings-actions">
              <button onClick={saveAi}>Save AI settings</button>
            </div>
          </>
        ) : null}

        {currentSection === "import-history" ? (
          <section className="settings-section">
            <div className="settings-actions">
              <Link to="/imports" className="button-secondary">Open import flow</Link>
            </div>
            {importJobs.length === 0 ? (
              <EmptyState title="No imports yet" description="Run an import from the Imports area to populate this history." />
            ) : (
              <div className="settings-section settings-section-subtle">
                {importJobs.map((job) => (
                    <div key={job.id} className="settings-row">
                    <div className="settings-row__content">
                      <strong>{job.sourceLabel}</strong>
                        <p>{job.provider} â€¢ {job.importedCount} pages â€¢ {new Date(job.updatedAt).toLocaleString()}</p>
                    </div>
                    <p>{job.provider} â€¢ {job.importedCount} pages</p>
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
                    <span>{item.actor_name} â€¢ {new Date(item.created_at).toLocaleString()}</span>
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
