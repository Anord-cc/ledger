import { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import type { PageSummary } from "@ledger/shared";
import { Icon } from "./Icon";

type Space = {
  id: string;
  name: string;
  key: string;
  visibility: string;
};

type PageNode = PageSummary & { children: PageNode[] };

function closeSidebarOnMobile(onClose: () => void) {
  if (window.innerWidth <= 920) {
    onClose();
  }
}

function buildTree(pages: PageSummary[]) {
  const byId = new Map<string, PageNode>();
  const roots: PageNode[] = [];

  for (const page of pages) {
    byId.set(page.id, { ...page, children: [] });
  }

  for (const node of byId.values()) {
    if (node.parentPageId && byId.has(node.parentPageId)) {
      byId.get(node.parentPageId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  const sortNodes = (nodes: PageNode[]) => {
    nodes.sort((a, b) => a.title.localeCompare(b.title));
    nodes.forEach((node) => sortNodes(node.children));
  };

  sortNodes(roots);
  return roots;
}

function TreeNode({
  node,
  depth,
  currentSlug,
  onClose
}: {
  node: PageNode;
  depth: number;
  currentSlug: string | undefined;
  onClose: () => void;
}) {
  const [isOpen, setIsOpen] = useState(true);
  const isActive = node.slug === currentSlug;
  const hasChildren = node.children.length > 0;

  return (
    <div className="tree-node">
      <div className={`tree-item${isActive ? " is-active" : ""}`} style={{ paddingLeft: `${depth * 0.85 + 0.75}rem` }}>
        {hasChildren ? (
          <button
            type="button"
            className="tree-toggle"
            onClick={() => setIsOpen((value) => !value)}
            aria-label={isOpen ? "Collapse section" : "Expand section"}
          >
            <Icon name={isOpen ? "chevronDown" : "chevronRight"} className="icon icon-sm" />
          </button>
        ) : (
          <span className="tree-spacer" />
        )}
        <Link to={`/page/${node.slug}`} className="tree-link" onClick={() => closeSidebarOnMobile(onClose)}>
          <span className="tree-link__title">{node.title}</span>
          <span className={`badge badge-${node.visibility}`}>{node.visibility}</span>
        </Link>
      </div>
      {hasChildren && isOpen ? (
        <div className="tree-children">
          {node.children.map((child) => (
            <TreeNode key={child.id} node={child} depth={depth + 1} currentSlug={currentSlug} onClose={onClose} />
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function DocsSidebar({
  spaces,
  pagesBySpace,
  currentSpaceKey,
  currentSlug,
  user,
  isOpen,
  onClose
}: {
  spaces: Space[];
  pagesBySpace: Record<string, PageSummary[]>;
  currentSpaceKey?: string;
  currentSlug?: string;
  user: { displayName: string; role: string } | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const location = useLocation();
  const [collapsedSpaces, setCollapsedSpaces] = useState<Record<string, boolean>>({});

  const recentPages = useMemo(
    () =>
      Object.values(pagesBySpace)
        .flat()
        .sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt))
        .slice(0, 5),
    [pagesBySpace]
  );

  return (
    <>
      <div className={`sidebar-overlay${isOpen ? " is-open" : ""}`} onClick={onClose} />
      <aside className={`sidebar${isOpen ? " is-open" : ""}`}>
        <div className="sidebar__top">
          <div>
            <p className="eyebrow">Workspace</p>
            <h2 className="sidebar__workspace">Ledger</h2>
            <p className="muted">{user ? `${user.displayName} - ${user.role}` : "Public knowledge base"}</p>
          </div>
          <button type="button" className="mobile-only button-ghost" onClick={onClose} aria-label="Close navigation">
            <Icon name="chevronRight" className="icon" />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Primary">
          <Link
            className={`sidebar-nav__item${location.pathname === "/" ? " is-current" : ""}`}
            to="/"
            onClick={() => closeSidebarOnMobile(onClose)}
          >
            <Icon name="home" className="icon icon-sm" />
            <span>Overview</span>
          </Link>
          <Link
            className={`sidebar-nav__item${location.pathname === "/dashboard" ? " is-current" : ""}`}
            to="/dashboard"
            onClick={() => closeSidebarOnMobile(onClose)}
          >
            <Icon name="settings" className="icon icon-sm" />
            <span>Manage</span>
          </Link>
        </nav>

        <section className="sidebar-section">
          <div className="sidebar-section__header">
            <span>Recent</span>
          </div>
          <div className="sidebar-list">
            {recentPages.length === 0 ? <p className="muted">No documents yet.</p> : null}
            {recentPages.map((page) => (
              <Link
                key={page.id}
                to={`/page/${page.slug}`}
                className={`sidebar-doc${page.slug === currentSlug ? " is-current" : ""}`}
                onClick={() => closeSidebarOnMobile(onClose)}
              >
                <Icon name="document" className="icon icon-sm" />
                <span>{page.title}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="sidebar-section">
          <div className="sidebar-section__header">
            <span>Collections</span>
          </div>
          <div className="sidebar-collections">
            {spaces.map((space) => {
              const isCollapsed = collapsedSpaces[space.key] ?? false;
              const tree = buildTree(pagesBySpace[space.key] ?? []);

              return (
                <div key={space.id} className="collection-group">
                  <button
                    type="button"
                    className={`collection-group__header${space.key === currentSpaceKey ? " is-current" : ""}`}
                    onClick={() =>
                      setCollapsedSpaces((current) => ({
                        ...current,
                        [space.key]: !isCollapsed
                      }))
                    }
                  >
                    <span className="collection-group__title">
                      <Icon name={isCollapsed ? "chevronRight" : "chevronDown"} className="icon icon-sm" />
                      <Icon name="collection" className="icon icon-sm" />
                      {space.name}
                    </span>
                    <span className={`badge badge-${space.visibility}`}>{space.visibility}</span>
                  </button>

                  {!isCollapsed ? (
                    <div className="collection-group__body">
                      <Link
                        to={`/space/${space.key}`}
                        className={`collection-link${space.key === currentSpaceKey && !currentSlug ? " is-current" : ""}`}
                        onClick={() => closeSidebarOnMobile(onClose)}
                      >
                        Browse collection
                      </Link>
                      {tree.length === 0 ? <p className="muted">No published pages yet.</p> : null}
                      {tree.map((node) => (
                        <TreeNode key={node.id} node={node} depth={0} currentSlug={currentSlug} onClose={onClose} />
                      ))}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </section>
      </aside>
    </>
  );
}
