import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link, Route, Routes, useLocation, useNavigate, useParams } from "react-router-dom";
import type { PageDetail, PageSummary, SessionUser } from "@ledger/shared";
import { CommandSearch } from "./components/CommandSearch";
import { EmptyState } from "./components/EmptyState";
import { FeedbackForm } from "./components/FeedbackForm";
import { Icon } from "./components/Icon";
import { PageEditor } from "./components/PageEditor";
import { DocsSidebar } from "./components/DocsSidebar";
import { SearchBar } from "./components/SearchBar";
import { ContentSkeleton, SidebarSkeleton } from "./components/Skeleton";
import { api } from "./lib/api";

type BrandingResponse = {
  branding: {
    siteName: string;
    logoUrl?: string | null;
    brandColor: string;
    footerText: string | null;
    publicKnowledgeBaseEnabled: boolean;
  };
};

type SetupStatus = {
  isInitialized: boolean;
  branding: {
    site_name: string;
    brand_color: string;
  } | null;
};

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

type PageRecordMap = Record<string, PageSummary[]>;

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

function useKnowledgeBaseData(enabled: boolean) {
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [pagesBySpace, setPagesBySpace] = useState<PageRecordMap>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    let active = true;
    setLoading(true);
    setError(null);

    api
      .get<{ spaces: Space[] }>("/api/spaces")
      .then(async (response) => {
        if (!active) return;
        setSpaces(response.spaces);

        const entries = await Promise.all(
          response.spaces.map(async (space) => {
            const pages = await api.get<{ pages: PageSummary[] }>(`/api/pages/space/${space.key}`);
            return [space.key, pages.pages] as const;
          })
        );

        if (!active) return;
        setPagesBySpace(Object.fromEntries(entries));
      })
      .catch((reason) => {
        if (!active) return;
        setError(reason instanceof Error ? reason.message : "Could not load documentation.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled]);

  return { spaces, pagesBySpace, loading, error };
}

function useCommandShortcut(openSearch: () => void) {
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        openSearch();
      }

      if (!isTyping && event.key === "/") {
        event.preventDefault();
        openSearch();
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [openSearch]);
}

function findCurrentSpace(spaces: Space[], page: PageDetail | null, pathname: string) {
  if (page) {
    return spaces.find((space) => space.id === page.spaceId);
  }

  const match = pathname.match(/^\/space\/([^/]+)/);
  if (!match) {
    return undefined;
  }

  return spaces.find((space) => space.key === match[1]);
}

function buildBreadcrumbs(page: PageDetail, pages: PageSummary[], space?: Space) {
  const byId = new Map(pages.map((item) => [item.id, item]));
  const trail: Array<{ title: string; slug?: string }> = [];
  let current: PageSummary | undefined = page;

  while (current?.parentPageId) {
    const parent = byId.get(current.parentPageId);
    if (!parent) break;
    trail.unshift({ title: parent.title, slug: parent.slug });
    current = parent;
  }

  return [
    { title: "Knowledge base" },
    ...(space ? [{ title: space.name }] : []),
    ...trail,
    { title: page.title, slug: page.slug }
  ];
}

function addCopyButtons(container: HTMLElement | null) {
  if (!container) return;

  container.querySelectorAll("pre").forEach((pre) => {
    if (pre.querySelector(".code-copy")) {
      return;
    }

    const code = pre.querySelector("code");
    if (!code) return;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "code-copy";
    button.textContent = "Copy";
    button.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(code.textContent ?? "");
        button.textContent = "Copied";
        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 1200);
      } catch {
        button.textContent = "Failed";
      }
    });

    pre.appendChild(button);
  });
}

function DocsShell({
  branding,
  user,
  spaces,
  pagesBySpace,
  loadingNavigation,
  navigationError,
  searchResults,
  searchLoading,
  onSearch,
  onLogout,
  children
}: {
  branding: BrandingResponse["branding"] | null;
  user: SessionUser | null;
  spaces: Space[];
  pagesBySpace: PageRecordMap;
  loadingNavigation: boolean;
  navigationError: string | null;
  searchResults: PageSummary[];
  searchLoading: boolean;
  onSearch: (query: string) => void;
  onLogout: () => Promise<void>;
  children: React.ReactNode;
}) {
  const location = useLocation();
  const [searchOpen, setSearchOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const currentPageSlug = location.pathname.startsWith("/page/")
    ? decodeURIComponent(location.pathname.split("/page/")[1] ?? "")
    : undefined;

  useCommandShortcut(() => setSearchOpen(true));

  const currentPage = useMemo(
    () =>
      Object.values(pagesBySpace)
        .flat()
        .find((page) => page.slug === currentPageSlug),
    [currentPageSlug, pagesBySpace]
  );

  const currentSpace = currentPage
    ? spaces.find((space) => space.id === currentPage.spaceId)
    : findCurrentSpace(spaces, null, location.pathname);

  return (
    <div className="kb-app">
      <CommandSearch
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        onSearch={onSearch}
        spaces={spaces}
        results={searchResults}
        isLoading={searchLoading}
      />

      {loadingNavigation ? (
        <SidebarSkeleton />
      ) : navigationError ? (
        <aside className="sidebar sidebar-state">
          <EmptyState eyebrow="Navigation" title="Could not load collections" description={navigationError} />
        </aside>
      ) : (
        <DocsSidebar
          spaces={spaces}
          pagesBySpace={pagesBySpace}
          currentSpaceKey={currentSpace?.key}
          currentSlug={currentPageSlug}
          user={user ? { displayName: user.displayName, role: user.role } : null}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
      )}

      <div className="kb-main">
        <header className="app-header">
          <div className="app-header__left">
            <button type="button" className="button-ghost mobile-only" onClick={() => setSidebarOpen(true)}>
              <Icon name="menu" className="icon" />
            </button>
            <Link to="/" className="brand brand-header">
              <span className="brand-mark" style={{ background: branding?.brandColor ?? "#245cff" }} />
              <div>
                <strong>{branding?.siteName ?? "Ledger"}</strong>
                <small>Documentation workspace</small>
              </div>
            </Link>
          </div>

          <div className="app-header__center">
            <button type="button" className="search-launcher" onClick={() => setSearchOpen(true)}>
              <Icon name="search" className="icon icon-sm" />
              <span>Search documentation</span>
              <kbd>{navigator.platform.toLowerCase().includes("mac") ? "Cmd K" : "Ctrl K"}</kbd>
            </button>
          </div>

          <div className="app-header__right">
            {user ? (
              <>
                <Link to="/dashboard" className="button-ghost">Manage</Link>
                <button className="button-ghost" onClick={onLogout}>Sign out</button>
              </>
            ) : (
              <Link to="/login" className="button-ghost">Sign in</Link>
            )}
          </div>
        </header>

        <main className="app-content">{children}</main>
        <footer className="app-footer">{branding?.footerText ?? "Built for fast, trusted answers."}</footer>
      </div>
    </div>
  );
}

function HomePage({
  spaces,
  pagesBySpace,
  onSearch
}: {
  spaces: Space[];
  pagesBySpace: PageRecordMap;
  onSearch: (query: string) => void;
}) {
  const navigate = useNavigate();
  const allPages = useMemo(
    () =>
      Object.values(pagesBySpace)
        .flat()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [pagesBySpace]
  );

  return (
    <div className="overview-layout">
      <section className="overview-hero">
        <div>
          <p className="eyebrow">Documentation hub</p>
          <h1>Find trusted answers, onboarding guides, and internal knowledge.</h1>
          <p className="lede">
            Browse collections, jump into recently updated docs, or search across your knowledge
            base from one calm workspace.
          </p>
        </div>
        <SearchBar onSearch={onSearch} placeholder="Search by title, concept, or workflow" />
      </section>

      <section className="overview-grid">
        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Collections</p>
              <h3>Browse by space</h3>
            </div>
          </div>
          <div className="collection-cards">
            {spaces.map((space) => (
              <button key={space.id} className="collection-card" onClick={() => navigate(`/space/${space.key}`)}>
                <div className="collection-card__icon">
                  <Icon name="collection" className="icon" />
                </div>
                <div>
                  <strong>{space.name}</strong>
                  <p>{space.visibility} knowledge</p>
                </div>
                <span>{(pagesBySpace[space.key] ?? []).length} docs</span>
              </button>
            ))}
          </div>
        </div>

        <div className="panel">
          <div className="panel__header">
            <div>
              <p className="eyebrow">Recently updated</p>
              <h3>Fresh documentation</h3>
            </div>
          </div>
          <div className="article-list">
            {allPages.slice(0, 8).map((page) => (
              <Link key={page.id} to={`/page/${page.slug}`} className="article-list__item">
                <div className="article-list__meta">
                  <strong>{page.title}</strong>
                  <span>{spaces.find((space) => space.id === page.spaceId)?.name ?? "Collection"}</span>
                </div>
                <p>{page.excerpt ?? "Open this document to read more."}</p>
              </Link>
            ))}
            {allPages.length === 0 ? (
              <EmptyState
                title="No published articles yet"
                description="Complete setup, then create your first pages from the manage screen."
              />
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}

function SpacePage({ spaces, pagesBySpace }: { spaces: Space[]; pagesBySpace: PageRecordMap }) {
  const { spaceKey = "" } = useParams();
  const space = spaces.find((entry) => entry.key === spaceKey);
  const pages = pagesBySpace[spaceKey] ?? [];

  return (
    <div className="document-layout">
      <section className="doc-card">
        <div className="breadcrumbs">
          <Link to="/">Knowledge base</Link>
          <span>/</span>
          <span>{space?.name ?? spaceKey}</span>
        </div>
        <div className="doc-card__header">
          <div>
            <p className="eyebrow">Collection</p>
            <h1>{space?.name ?? spaceKey}</h1>
            <p className="lede">{pages.length} published documents are currently visible in this collection.</p>
          </div>
          <span className={`badge badge-${space?.visibility ?? "internal"}`}>{space?.visibility ?? "internal"}</span>
        </div>
        {pages.length === 0 ? (
          <EmptyState
            title="This collection is empty"
            description="Add documents from the manage screen to build out this space."
          />
        ) : (
          <div className="article-list">
            {pages.map((page) => (
              <Link key={page.id} to={`/page/${page.slug}`} className="article-list__item">
                <div className="article-list__meta">
                  <strong>{page.title}</strong>
                  <span>{page.visibility} - {new Date(page.updatedAt).toLocaleDateString()}</span>
                </div>
                <p>{page.excerpt ?? "Open this document to continue reading."}</p>
              </Link>
            ))}
          </div>
        )}
      </section>
      <aside className="right-rail">
        <section className="rail-card">
          <p className="eyebrow">Collection info</p>
          <h3>{space?.name ?? "Collection"}</h3>
          <p className="muted">
            Use the left navigation tree to browse pages and nested structure inside this space.
          </p>
        </section>
      </aside>
    </div>
  );
}

function PageView({
  spaces,
  pagesBySpace,
  user
}: {
  spaces: Space[];
  pagesBySpace: PageRecordMap;
  user: SessionUser | null;
}) {
  const { slug = "" } = useParams();
  const [page, setPage] = useState<PageDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const articleRef = useRef<HTMLElement>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    api
      .get<{ page: PageDetail }>(`/api/pages/slug/${slug}`)
      .then((response) => setPage(response.page))
      .catch((reason) => {
        setError(reason instanceof Error ? reason.message : "Could not load this page.");
        setPage(null);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(() => {
    if (page) {
      addCopyButtons(articleRef.current);
    }
  }, [page]);

  if (loading) {
    return (
      <div className="document-layout">
        <ContentSkeleton />
        <aside className="right-rail">
          <div className="rail-card">
            <div className="skeleton skeleton-title" />
            <div className="skeleton skeleton-line" />
            <div className="skeleton skeleton-line short" />
          </div>
        </aside>
      </div>
    );
  }

  if (!page) {
    return (
      <div className="document-layout">
        <section className="doc-card">
          <EmptyState
            eyebrow="Document"
            title="Page not found"
            description={error ?? "This page may not exist, or your account may not be allowed to view it."}
            action={<Link to="/" className="button-secondary">Back to knowledge base</Link>}
          />
        </section>
      </div>
    );
  }

  const space = spaces.find((entry) => entry.id === page.spaceId);
  const breadcrumbs = buildBreadcrumbs(page, pagesBySpace[space?.key ?? ""] ?? [], space);

  async function copyLink() {
    await navigator.clipboard.writeText(window.location.href);
  }

  return (
    <div className="document-layout">
      <article className="doc-card">
        <div className="breadcrumbs">
          {breadcrumbs.map((item, index) => (
            <React.Fragment key={`${item.title}-${index}`}>
              {index > 0 ? <span>/</span> : null}
              {item.slug && index < breadcrumbs.length - 1 ? (
                <Link to={`/page/${item.slug}`}>{item.title}</Link>
              ) : (
                <span>{item.title}</span>
              )}
            </React.Fragment>
          ))}
        </div>

        <header className="doc-card__header doc-card__header-spread">
          <div>
            <div className="doc-badges">
              <span className={`badge badge-${page.visibility}`}>
                <Icon name={page.visibility === "public" ? "globe" : "lock"} className="icon icon-sm" />
                {page.visibility}
              </span>
              <span className="badge badge-muted">{page.state}</span>
            </div>
            <h1>{page.title}</h1>
            <p className="doc-meta">
              Updated {new Date(page.updatedAt).toLocaleDateString()} by {page.authorName}
            </p>
          </div>

          <div className="doc-actions">
            <button type="button" className="button-secondary" onClick={copyLink}>
              <Icon name="copy" className="icon icon-sm" />
              Copy link
            </button>
            {user && (user.role === "editor" || user.role === "admin" || user.role === "owner") ? (
              <Link to="/dashboard" className="button-secondary">
                <Icon name="external" className="icon icon-sm" />
                Edit in manage
              </Link>
            ) : null}
          </div>
        </header>

        {page.excerpt ? <p className="doc-summary">{page.excerpt}</p> : null}

        <div ref={articleRef} className="markdown markdown-prose" dangerouslySetInnerHTML={{ __html: page.bodyHtml }} />
        <FeedbackForm pageId={page.id} revisionId={page.revisionId} />
      </article>

      <aside className="right-rail">
        <section className="rail-card">
          <p className="eyebrow">On this page</p>
          {page.toc.length === 0 ? <p className="muted">No headings yet.</p> : null}
          <nav className="toc-rail">
            {page.toc.map((item) => (
              <a key={item.id} href={`#${item.id}`} style={{ paddingLeft: `${(item.level - 1) * 0.75}rem` }}>
                {item.text}
              </a>
            ))}
          </nav>
        </section>

        <section className="rail-card">
          <p className="eyebrow">Context</p>
          <div className="context-list">
            <div>
              <span>Collection</span>
              <strong>{space?.name ?? "Unknown"}</strong>
            </div>
            <div>
              <span>State</span>
              <strong>{page.state}</strong>
            </div>
            <div>
              <span>Access</span>
              <strong>{page.visibility}</strong>
            </div>
          </div>
        </section>
      </aside>
    </div>
  );
}

function LoginPage({ onLogin }: { onLogin: (user: SessionUser) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
    <div className="auth-layout">
      <section className="auth-panel">
        <p className="eyebrow">Secure access</p>
        <h1>Sign in to internal documentation</h1>
        <p className="muted">
          Access private knowledge, restricted runbooks, and editing tools with your Ledger account.
        </p>
      </section>
      <form className="panel auth-form" onSubmit={submit}>
        <div className="panel__header">
          <div>
            <p className="eyebrow">Authentication</p>
            <h3>Welcome back</h3>
          </div>
        </div>
        <label className="field">
          Email
          <input value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="field">
          Password
          <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        <button type="submit">Sign in</button>
        {error ? <p className="muted">{error}</p> : null}
      </form>
    </div>
  );
}

function SetupPage({
  onInitialized,
  initialBranding
}: {
  onInitialized: (user: SessionUser, branding: BrandingResponse["branding"]) => void;
  initialBranding: SetupStatus["branding"];
}) {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    siteName: initialBranding?.site_name ?? "Ledger",
    brandColor: initialBranding?.brand_color ?? "#245cff",
    footerText: "Built for fast, trusted answers.",
    publicKnowledgeBaseEnabled: true,
    ownerEmail: "",
    ownerDisplayName: "",
    password: ""
  });
  const [status, setStatus] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      const response = await api.post<{ user: SessionUser }>("/api/setup/initialize", {
        ...form,
        footerText: form.footerText || null
      });

      onInitialized(response.user, {
        siteName: form.siteName,
        logoUrl: null,
        brandColor: form.brandColor,
        footerText: form.footerText || null,
        publicKnowledgeBaseEnabled: form.publicKnowledgeBaseEnabled
      });

      navigate("/dashboard");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not initialize Ledger");
    }
  }

  return (
    <div className="setup-screen">
      <section className="auth-panel">
        <p className="eyebrow">First-time setup</p>
        <h1>Create your Ledger knowledge base</h1>
        <p className="lede">
          Define the base identity for your documentation workspace, create the first owner, and
          launch into collections, content, and integrations.
        </p>
        <div className="setup-points">
          <div><Icon name="collection" className="icon icon-sm" /> Collections and page structure</div>
          <div><Icon name="search" className="icon icon-sm" /> Search-first reading experience</div>
          <div><Icon name="settings" className="icon icon-sm" /> Ready for branding and integrations</div>
        </div>
      </section>

      <form className="panel setup-form" onSubmit={submit}>
        <div className="panel__header">
          <div>
            <p className="eyebrow">Workspace settings</p>
            <h3>Initialize Ledger</h3>
          </div>
        </div>

        <div className="field-grid">
          <label className="field">
            Site name
            <input
              value={form.siteName}
              onChange={(event) => setForm((current) => ({ ...current, siteName: event.target.value }))}
            />
          </label>
          <label className="field">
            Brand color
            <input
              value={form.brandColor}
              onChange={(event) => setForm((current) => ({ ...current, brandColor: event.target.value }))}
            />
          </label>
        </div>

        <label className="field">
          Footer text
          <input
            value={form.footerText}
            onChange={(event) => setForm((current) => ({ ...current, footerText: event.target.value }))}
          />
        </label>

        <label className="checkbox-row checkbox-card">
          <input
            type="checkbox"
            checked={form.publicKnowledgeBaseEnabled}
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                publicKnowledgeBaseEnabled: event.target.checked
              }))
            }
          />
          <span>Enable the public knowledge base immediately</span>
        </label>

        <div className="field-grid">
          <label className="field">
            Owner name
            <input
              value={form.ownerDisplayName}
              onChange={(event) => setForm((current) => ({ ...current, ownerDisplayName: event.target.value }))}
            />
          </label>
          <label className="field">
            Owner email
            <input
              value={form.ownerEmail}
              onChange={(event) => setForm((current) => ({ ...current, ownerEmail: event.target.value }))}
            />
          </label>
        </div>

        <label className="field">
          Password
          <input
            type="password"
            value={form.password}
            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
          />
        </label>

        <button type="submit">Create workspace</button>
        {status ? <p className="muted">{status}</p> : null}
      </form>
    </div>
  );
}

function Dashboard({ user, spaces }: { user: SessionUser; spaces: Space[] }) {
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
    if (user.role === "admin" || user.role === "owner") {
      api
        .get<{
          topSearches: Array<{ query: string; count: number }>;
          noResults: Array<{ query: string; count: number }>;
        }>("/api/admin/search-analytics")
        .then(setAnalytics);
      api
        .get<{ feedback: Array<{ id: string; page_title: string; helpful: boolean; comment: string | null }> }>("/api/admin/feedback")
        .then((response) => setFeedback(response.feedback));
      api
        .get<{ branding: { site_name: string; logo_url: string | null; brand_color: string; footer_text: string | null; public_knowledge_base_enabled: boolean } }>("/api/settings/admin")
        .then((response) => {
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
      setSettingsStatus("Brand settings saved.");
    } catch (error) {
      setSettingsStatus(error instanceof Error ? error.message : "Could not save branding");
    }
  }

  return (
    <div className="manage-layout">
      <section className="panel manage-hero">
        <div>
          <p className="eyebrow">Manage workspace</p>
          <h1>{user.displayName}</h1>
          <p className="lede">Create documents, tune branding, and use search analytics to improve the knowledge base.</p>
        </div>
        <div className="manage-hero__meta">
          <span className="pill">{user.role}</span>
          <span className="pill">{spaces.length} collections</span>
        </div>
      </section>

      <div className="manage-grid">
        {user.role === "editor" || user.role === "admin" || user.role === "owner" ? (
          <PageEditor spaces={spaces} />
        ) : null}

        {user.role === "admin" || user.role === "owner" ? (
          <section className="panel">
            <div className="panel__header">
              <div>
                <p className="eyebrow">Branding</p>
                <h3>Workspace settings</h3>
              </div>
            </div>

            <label className="field">
              Site name
              <input
                value={brandingForm.siteName}
                onChange={(event) => setBrandingForm((current) => ({ ...current, siteName: event.target.value }))}
              />
            </label>
            <div className="field-grid">
              <label className="field">
                Brand color
                <input
                  value={brandingForm.brandColor}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, brandColor: event.target.value }))}
                />
              </label>
              <label className="field">
                Logo URL
                <input
                  value={brandingForm.logoUrl}
                  onChange={(event) => setBrandingForm((current) => ({ ...current, logoUrl: event.target.value }))}
                />
              </label>
            </div>
            <label className="field">
              Footer text
              <input
                value={brandingForm.footerText}
                onChange={(event) => setBrandingForm((current) => ({ ...current, footerText: event.target.value }))}
              />
            </label>
            <label className="checkbox-row checkbox-card">
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
              <span>Public knowledge base enabled</span>
            </label>
            <div className="panel__footer">
              <button onClick={saveBranding}>Save settings</button>
              {settingsStatus ? <p className="muted">{settingsStatus}</p> : null}
            </div>
          </section>
        ) : null}

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
      </div>
    </div>
  );
}

export function App() {
  const { user, setUser, loading } = useSession();
  const [branding, setBranding] = useState<BrandingResponse["branding"] | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [searchResults, setSearchResults] = useState<PageSummary[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  useEffect(() => {
    api.get<BrandingResponse>("/api/settings/public").then((response) => setBranding(response.branding));
    api.get<SetupStatus>("/api/setup/status").then(setSetupStatus);
  }, []);

  const { spaces, pagesBySpace, loading: loadingNavigation, error: navigationError } = useKnowledgeBaseData(
    Boolean(setupStatus?.isInitialized)
  );

  async function logout() {
    await api.post("/api/auth/logout");
    setUser(null);
  }

  async function handleSearch(query: string) {
    if (!query.trim()) {
      setSearchResults([]);
      return;
    }

    setSearchLoading(true);
    try {
      const response = await api.get<{ pages: PageSummary[] }>(`/api/search?q=${encodeURIComponent(query)}`);
      setSearchResults(response.pages);
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  }

  if (loading || !setupStatus) {
    return <div className="loading-screen">Loading Ledger...</div>;
  }

  if (!setupStatus.isInitialized) {
    return (
      <div className="app-standalone">
        <SetupPage
          initialBranding={setupStatus.branding}
          onInitialized={(initializedUser, initializedBranding) => {
            setUser(initializedUser);
            setBranding(initializedBranding);
            setSetupStatus({
              isInitialized: true,
              branding: {
                site_name: initializedBranding.siteName,
                brand_color: initializedBranding.brandColor
              }
            });
          }}
        />
      </div>
    );
  }

  return (
    <DocsShell
      branding={branding}
      user={user}
      spaces={spaces}
      pagesBySpace={pagesBySpace}
      loadingNavigation={loadingNavigation}
      navigationError={navigationError}
      searchResults={searchResults}
      searchLoading={searchLoading}
      onSearch={handleSearch}
      onLogout={logout}
    >
      <Routes>
        <Route path="/" element={<HomePage spaces={spaces} pagesBySpace={pagesBySpace} onSearch={handleSearch} />} />
        <Route path="/login" element={<LoginPage onLogin={setUser} />} />
        <Route path="/space/:spaceKey" element={<SpacePage spaces={spaces} pagesBySpace={pagesBySpace} />} />
        <Route path="/page/:slug" element={<PageView spaces={spaces} pagesBySpace={pagesBySpace} user={user} />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} spaces={spaces} /> : <LoginPage onLogin={setUser} />} />
      </Routes>
    </DocsShell>
  );
}
