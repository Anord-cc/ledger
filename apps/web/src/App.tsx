import React, { useEffect, useState } from "react";
import { Link, Route, Routes, useNavigate, useParams } from "react-router-dom";
import type { PageDetail, PageSummary, SessionUser } from "@ledger/shared";
import { FeedbackForm } from "./components/FeedbackForm";
import { PageEditor } from "./components/PageEditor";
import { PageSidebar } from "./components/PageSidebar";
import { SearchBar } from "./components/SearchBar";
import { api } from "./lib/api";

type BrandingResponse = {
  branding: {
    siteName: string;
    brandColor: string;
    footerText: string | null;
    publicKnowledgeBaseEnabled: boolean;
  };
};

function useSession() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ user: SessionUser | null }>("/api/auth/session")
      .then((response) => setUser(response.user))
      .finally(() => setLoading(false));
  }, []);

  return { user, setUser, loading };
}

function Shell({
  children,
  branding,
  user,
  onLogout
}: {
  children: React.ReactNode;
  branding: BrandingResponse["branding"] | null;
  user: SessionUser | null;
  onLogout: () => Promise<void>;
}) {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark" style={{ background: branding?.brandColor ?? "#245cff" }} />
          <div>
            <strong>{branding?.siteName ?? "Ledger"}</strong>
            <small>Trusted answers for teams</small>
          </div>
        </Link>
        <nav className="topnav">
          <Link to="/">Knowledge base</Link>
          {user ? <Link to="/dashboard">Dashboard</Link> : <Link to="/login">Sign in</Link>}
          {user ? (
            <button className="button-secondary" onClick={onLogout}>
              Sign out
            </button>
          ) : null}
        </nav>
      </header>
      <main>{children}</main>
      <footer className="footer">{branding?.footerText ?? "Built for fast, trusted answers."}</footer>
    </div>
  );
}

function HomePage() {
  const navigate = useNavigate();
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string; key: string; visibility: string }>>([]);
  const [results, setResults] = useState<PageSummary[]>([]);

  useEffect(() => {
    api
      .get<{ spaces: Array<{ id: string; name: string; key: string; visibility: string }> }>("/api/spaces")
      .then((response) => setSpaces(response.spaces))
      .catch(() => setSpaces([]));
  }, []);

  async function runSearch(query: string) {
    const response = await api.get<{ pages: PageSummary[] }>(
      `/api/search?q=${encodeURIComponent(query)}`
    );
    setResults(response.pages);
  }

  return (
    <div className="hero-layout">
      <section className="hero-card">
        <p className="eyebrow">Open-source knowledge base</p>
        <h1>Find the answer fast. Keep internal knowledge protected.</h1>
        <p className="lede">
          Ledger gives teams a public docs experience and an internal knowledge base on the same
          foundation, with backend-enforced visibility rules.
        </p>
        <SearchBar onSearch={runSearch} />
      </section>
      <section className="grid">
        <div className="card">
          <h3>Spaces</h3>
          <div className="stack">
            {spaces.map((space) => (
              <button key={space.id} className="space-link" onClick={() => navigate(`/space/${space.key}`)}>
                <span>{space.name}</span>
                <small>{space.visibility}</small>
              </button>
            ))}
          </div>
        </div>
        <div className="card">
          <h3>Search results</h3>
          <div className="stack">
            {results.length === 0 ? <p className="muted">Search the knowledge base to see results.</p> : null}
            {results.map((page) => (
              <Link key={page.id} to={`/page/${page.slug}`} className="result-item">
                <strong>{page.title}</strong>
                <span>{page.excerpt}</span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function SpacePage() {
  const { spaceKey = "" } = useParams();
  const [pages, setPages] = useState<PageSummary[]>([]);

  useEffect(() => {
    api.get<{ pages: PageSummary[] }>(`/api/pages/space/${spaceKey}`).then((response) => setPages(response.pages));
  }, [spaceKey]);

  return (
    <div className="content-layout">
      <PageSidebar pages={pages} title={`Space: ${spaceKey}`} />
      <section className="card">
        <h2>{spaceKey}</h2>
        <p className="muted">Select a page from the sidebar.</p>
      </section>
    </div>
  );
}

function PageView() {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<PageDetail | null>(null);
  const [related, setRelated] = useState<PageSummary[]>([]);

  useEffect(() => {
    api.get<{ page: PageDetail }>(`/api/pages/slug/${slug}`).then((response) => {
      setPage(response.page);
      return api.get<{ pages: PageSummary[] }>(`/api/pages/space/${response.page.spaceId}`);
    }).then((response) => setRelated(response.pages))
      .catch(() => {
        setPage(null);
        setRelated([]);
      });
  }, [slug]);

  if (!page) {
    return <section className="card">Page not found or not visible to your account.</section>;
  }

  return (
    <div className="content-layout">
      <PageSidebar pages={related} title="Pages" />
      <article className="page-card">
        <div className="page-card__header">
          <div>
            <p className="eyebrow">{page.visibility}</p>
            <h1>{page.title}</h1>
          </div>
          <span className={`pill pill-${page.visibility}`}>{page.state}</span>
        </div>
        <div className="toc">
          {page.toc.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.text}
            </a>
          ))}
        </div>
        <div className="markdown" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
        <FeedbackForm pageId={page.id} revisionId={page.revisionId} />
      </article>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("owner@ledger.local");
  const [password, setPassword] = useState("Password123!");
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await api.post<{ user: SessionUser }>("/api/auth/login", { email, password });
      onLogin(response.user);
      navigate("/dashboard");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Could not sign in");
    }
  }

  return (
    <section className="auth-card">
      <p className="eyebrow">Sign in</p>
      <h1>Access internal knowledge</h1>
      <form className="stack" onSubmit={submit}>
        <label>
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label>
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit">Sign in</button>
      </form>
      {error ? <p className="muted">{error}</p> : null}
    </section>
  );
}

function Dashboard({ user }: { user: SessionUser }) {
  const [spaces, setSpaces] = useState<Array<{ id: string; name: string; key: string }>>([]);
  const [analytics, setAnalytics] = useState<{
    topSearches: Array<{ query: string; count: number }>;
    noResults: Array<{ query: string; count: number }>;
  } | null>(null);
  const [feedback, setFeedback] = useState<Array<{ id: string; page_title: string; helpful: boolean; comment: string | null }> | null>(null);
  const [brandingForm, setBrandingForm] = useState({
    siteName: "Ledger",
    logoUrl: "",
    brandColor: "#245cff",
    footerText: "",
    publicKnowledgeBaseEnabled: true
  });
  const [settingsStatus, setSettingsStatus] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<{ spaces: Array<{ id: string; name: string; key: string }> }>("/api/spaces")
      .then((response) => setSpaces(response.spaces));
  }, []);

  useEffect(() => {
    if (user.role === "admin" || user.role === "owner") {
      api
        .get<{
          topSearches: Array<{ query: string; count: number }>;
          noResults: Array<{ query: string; count: number }>;
        }>("/api/admin/search-analytics")
        .then(setAnalytics);
      api
        .get<{ feedback: Array<{ id: string; page_title: string; helpful: boolean; comment: string | null }> }>(
          "/api/admin/feedback"
        )
        .then((response) => setFeedback(response.feedback));
      api.get<{ branding: { site_name: string; logo_url: string | null; brand_color: string; footer_text: string | null; public_knowledge_base_enabled: boolean } }>("/api/settings/admin").then((response) => {
        const branding = response.branding;
        setBrandingForm({
          siteName: branding.site_name,
          logoUrl: branding.logo_url ?? "",
          brandColor: branding.brand_color,
          footerText: branding.footer_text ?? "",
          publicKnowledgeBaseEnabled: branding.public_knowledge_base_enabled
        });
      });
    }
  }, [user.role]);

  async function saveBranding() {
    try {
      await api.put("/api/settings/branding", {
        siteName: brandingForm.siteName,
        logoUrl: brandingForm.logoUrl || null,
        brandColor: brandingForm.brandColor,
        footerText: brandingForm.footerText || null,
        publicKnowledgeBaseEnabled: brandingForm.publicKnowledgeBaseEnabled
      });
      setSettingsStatus("Branding saved.");
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : "Could not save branding");
    }
  }

  return (
    <div className="dashboard-grid">
      <section className="card">
        <p className="eyebrow">Signed in as {user.displayName}</p>
        <h2>Knowledge base dashboard</h2>
        <p className="muted">Role: {user.role}</p>
      </section>
      {user.role === "editor" || user.role === "admin" || user.role === "owner" ? (
        <PageEditor spaces={spaces} />
      ) : null}
      {analytics ? (
        <section className="card">
          <h3>Search analytics</h3>
          <div className="split">
            <div>
              <strong>Top searches</strong>
              {analytics.topSearches.map((item) => (
                <p key={item.query}>{item.query} ({item.count})</p>
              ))}
            </div>
            <div>
              <strong>No results</strong>
              {analytics.noResults.map((item) => (
                <p key={item.query}>{item.query} ({item.count})</p>
              ))}
            </div>
          </div>
        </section>
      ) : null}
      {feedback ? (
        <section className="card">
          <h3>Feedback queue</h3>
          {feedback.map((item) => (
            <div key={item.id} className="feedback-item">
              <strong>{item.page_title}</strong>
              <span>{item.helpful ? "Helpful" : "Not helpful"}</span>
              <p>{item.comment ?? "No comment"}</p>
            </div>
          ))}
        </section>
      ) : null}
      {user.role === "admin" || user.role === "owner" ? (
        <section className="card">
          <h3>Brand settings</h3>
          <div className="stack">
            <label>
              Site name
              <input
                value={brandingForm.siteName}
                onChange={(event) =>
                  setBrandingForm((current) => ({ ...current, siteName: event.target.value }))
                }
              />
            </label>
            <label>
              Brand color
              <input
                value={brandingForm.brandColor}
                onChange={(event) =>
                  setBrandingForm((current) => ({ ...current, brandColor: event.target.value }))
                }
              />
            </label>
            <label>
              Footer text
              <input
                value={brandingForm.footerText}
                onChange={(event) =>
                  setBrandingForm((current) => ({ ...current, footerText: event.target.value }))
                }
              />
            </label>
            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={brandingForm.publicKnowledgeBaseEnabled}
                onChange={(event) =>
                  setBrandingForm((current) => ({
                    ...current,
                    publicKnowledgeBaseEnabled: event.target.checked
                  }))
                }
              />
              Public knowledge base enabled
            </label>
            <button onClick={saveBranding}>Save branding</button>
            {settingsStatus ? <p className="muted">{settingsStatus}</p> : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}

export function App() {
  const { user, setUser, loading } = useSession();
  const [branding, setBranding] = useState<BrandingResponse["branding"] | null>(null);

  useEffect(() => {
    api.get<BrandingResponse>("/api/settings/public").then((response) => setBranding(response.branding));
  }, []);

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
  }

  if (loading) {
    return <div className="loading-screen">Loading Ledger...</div>;
  }

  return (
    <Shell branding={branding} user={user} onLogout={logout}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="/space/:spaceKey" element={<SpacePage />} />
        <Route path="/page/:slug" element={<PageView />} />
        <Route
          path="/dashboard"
          element={user ? <Dashboard user={user} /> : <LoginPage onLogin={setUser} />}
        />
      </Routes>
    </Shell>
  );
}
