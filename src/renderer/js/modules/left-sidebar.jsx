import React from "react";

const NAV_ITEMS = [
  { id: "home",       label: "Home",    icon: "🏠" },
  { id: "connection", label: "Conexão", icon: "🔗" },
  { id: "chats",      label: "Chats",   icon: "💬" },
];

export function LeftSidebar({ activePage, onNavigate, groups, onSelectGroup }) {
  return (
    <aside className="left-sidebar">
      <nav className="left-sidebar__quick">
        {NAV_ITEMS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`left-sidebar__nav-btn${item.id === activePage ? " is-active" : ""}`}
            onClick={() => onNavigate(item.id)}
            title={item.label}
          >
            <span className="left-sidebar__nav-icon">{item.icon}</span>
            <span className="left-sidebar__nav-micro">{item.label}</span>
          </button>
        ))}
      </nav>

      <div className="left-sidebar__divider" />

      <section className="left-sidebar__groups">
        <div className="left-sidebar__group-list scroll-region">
          {groups.map((group) => (
            <button
              key={group.id}
              type="button"
              className="left-sidebar__group-icon"
              onClick={() => onSelectGroup(group.id)}
              title={group.label}
            >
              {group.short}
            </button>
          ))}
        </div>
      </section>
    </aside>
  );
}
