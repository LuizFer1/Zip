import React from "react";

function pageSubtitle(activePage) {
  if (activePage === "home") return "Home";
  if (activePage === "connection") return "Conexão P2P";
  return "Chats";
}

export function Topbar({
  identity,
  activePage,
  statusMessage,
  resolvedTheme,
  themePreference,
  onSetThemePreference,
}) {
  const initials = identity?.username
    ? identity.username.slice(0, 2).toUpperCase()
    : "?";

  return (
    <header className="topbar">
      <div className="topbar__brand">
        <div className="topbar__logo">Z</div>
        <div className="topbar__title">
          <h1>Zip</h1>
          <p>{pageSubtitle(activePage)}</p>
        </div>
      </div>

      <div className="topbar__status">
        <div className="topbar__identity-chip">
          <div className="topbar__identity-avatar">{initials}</div>
          <span className="topbar__identity-name">{identity?.username ?? "..."}</span>
        </div>
        <p>{statusMessage || "Rede local pronta para novos grupos."}</p>
      </div>

      <div className="topbar__actions">
        <div className="topbar__theme-group" role="group" aria-label="Tema">
          <button
            className={`topbar__theme-btn${themePreference === "light" ? " is-active" : ""}`}
            type="button"
            onClick={() => onSetThemePreference("light")}
            title="Tema claro"
          >
            ☀️
          </button>
          <button
            className={`topbar__theme-btn${themePreference === "dark" ? " is-active" : ""}`}
            type="button"
            onClick={() => onSetThemePreference("dark")}
            title="Tema escuro"
          >
            🌙
          </button>
          <button
            className={`topbar__theme-btn${themePreference === "system" ? " is-active" : ""}`}
            type="button"
            onClick={() => onSetThemePreference("system")}
            title="Seguir sistema"
          >
            💻
          </button>
        </div>
      </div>
    </header>
  );
}
