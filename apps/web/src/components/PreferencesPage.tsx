import { useEffect, useState } from "react";
import type { ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import type { SessionUser } from "@ledger/shared";
import { PageHeader } from "./PageHeader";

export type PreferencesState = {
  theme: "system" | "light" | "dark";
  compactSidebar: boolean;
  emailNotifications: boolean;
  productUpdates: boolean;
  smartText: boolean;
  showLineNumbers: boolean;
};

const sections = [
  ["profile", "Profile"],
  ["preferences", "Preferences"],
  ["appearance", "Appearance"],
  ["notifications", "Notifications"],
  ["account", "Account"]
] as const;

function SettingsRow({
  label,
  description,
  control
}: {
  label: string;
  description: string;
  control: ReactNode;
}) {
  return (
    <div className="settings-row">
      <div className="settings-row__content">
        <strong>{label}</strong>
        <p>{description}</p>
      </div>
      <div className="settings-row__control">{control}</div>
    </div>
  );
}

function Toggle({
  checked,
  onChange,
  disabled = false,
  label
}: {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <label className={`toggle-switch${disabled ? " is-disabled" : ""}`} aria-label={label}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-switch__track" />
    </label>
  );
}

export function PreferencesPage({
  user,
  preferences,
  onUpdatePreferences,
  onLogout
}: {
  user: SessionUser;
  preferences: PreferencesState;
  onUpdatePreferences: (patch: Partial<PreferencesState>) => void;
  onLogout: () => Promise<void>;
}) {
  const { section = "preferences" } = useParams();
  const currentSection = sections.some(([key]) => key === section) ? section : "preferences";
  const [displayName, setDisplayName] = useState(user.displayName);

  useEffect(() => {
    setDisplayName(user.displayName);
  }, [user.displayName]);

  function renderSection() {
    switch (currentSection) {
      case "profile":
        return (
          <section className="settings-section">
            <h2 className="settings-section__title">Profile</h2>
            <SettingsRow
              label="Display name"
              description="Profile editing is not connected to the server yet, but you can preview a preferred display name here."
              control={<input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />}
            />
            <SettingsRow
              label="Email"
              description="Your account email is controlled by Ledger authentication."
              control={<input value={user.email} disabled />}
            />
          </section>
        );
      case "appearance":
        return (
          <section className="settings-section">
            <h2 className="settings-section__title">Appearance</h2>
            <SettingsRow
              label="Theme"
              description="Choose how Ledger should appear on this device."
              control={
                <select
                  value={preferences.theme}
                  onChange={(event) =>
                    onUpdatePreferences({ theme: event.target.value as PreferencesState["theme"] })
                  }
                >
                  <option value="system">System</option>
                  <option value="light">Light</option>
                  <option value="dark">Dark</option>
                </select>
              }
            />
            <SettingsRow
              label="Compact sidebar"
              description="Reduce sidebar spacing for a denser documentation tree."
              control={
                <Toggle
                  label="Compact sidebar"
                  checked={preferences.compactSidebar}
                  onChange={(next) => onUpdatePreferences({ compactSidebar: next })}
                />
              }
            />
          </section>
        );
      case "notifications":
        return (
          <section className="settings-section">
            <h2 className="settings-section__title">Notifications</h2>
            <SettingsRow
              label="Email notifications"
              description="Receive important workspace updates by email when that functionality is enabled."
              control={
                <Toggle
                  label="Email notifications"
                  checked={preferences.emailNotifications}
                  onChange={(next) => onUpdatePreferences({ emailNotifications: next })}
                />
              }
            />
            <SettingsRow
              label="Product updates"
              description="Show product update notices inside Ledger."
              control={
                <Toggle
                  label="Product updates"
                  checked={preferences.productUpdates}
                  onChange={(next) => onUpdatePreferences({ productUpdates: next })}
                />
              }
            />
          </section>
        );
      case "account":
        return (
          <section className="settings-section">
            <h2 className="settings-section__title">Account</h2>
            <SettingsRow
              label="Current role"
              description="Your effective role in this workspace."
              control={<div className="settings-row__value">{user.role}</div>}
            />
            <SettingsRow
              label="Session"
              description="Sign out of the current Ledger session."
              control={
                <button type="button" className="button-secondary" onClick={() => void onLogout()}>
                  Sign out
                </button>
              }
            />
            <SettingsRow
              label="Danger zone"
              description="Advanced account actions are not available in this build yet."
              control={<button type="button" className="button-secondary" disabled>Unavailable</button>}
            />
          </section>
        );
      case "preferences":
      default:
        return (
          <>
            <section className="settings-section">
              <h2 className="settings-section__title">Preferences</h2>
              <SettingsRow
                label="Smart text replacements"
                description="Auto-format quotes, dashes, and common markdown shortcuts while editing."
                control={
                  <Toggle
                    label="Smart text replacements"
                    checked={preferences.smartText}
                    onChange={(next) => onUpdatePreferences({ smartText: next })}
                  />
                }
              />
              <SettingsRow
                label="Show line numbers"
                description="Display line numbers next to code blocks where supported."
                control={
                  <Toggle
                    label="Show line numbers"
                    checked={preferences.showLineNumbers}
                    onChange={(next) => onUpdatePreferences({ showLineNumbers: next })}
                  />
                }
              />
            </section>
          </>
        );
    }
  }

  return (
    <div className="preferences-shell">
      <aside className="preferences-sidebar">
        <Link to="/spaces" className="preferences-backlink">Back to app</Link>
        <div className="preferences-nav-group">
          <p className="preferences-nav-group__label">Account</p>
          <nav className="preferences-nav">
            {sections.map(([key, label]) => (
              <Link
                key={key}
                to={`/preferences/${key}`}
                className={`preferences-nav__item${currentSection === key ? " is-current" : ""}`}
              >
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </aside>

      <div className="preferences-content">
        <PageHeader
          eyebrow="Preferences"
          title={sections.find(([key]) => key === currentSection)?.[1] ?? "Preferences"}
          description="Manage settings that affect your personal Ledger experience on this device."
        />
        {renderSection()}
      </div>
    </div>
  );
}
