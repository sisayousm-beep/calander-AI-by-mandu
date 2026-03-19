import { NavLink, Outlet } from "react-router-dom";

const navItems = [
  { to: "/calendar", label: "캘린더" },
  { to: "/notes", label: "메모" },
  { to: "/graph", label: "관계도" },
  { to: "/functions", label: "함수" },
  { to: "/guide", label: "설명서" },
  { to: "/settings", label: "설정" },
];

export function AppLayout(): JSX.Element {
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-top">
          <div className="brand-mark">CA</div>
          <div className="brand">
            <span className="brand-kicker">Local-first planner</span>
            <strong>Calendar AI</strong>
            <span>Schedule, notes, links, rules.</span>
          </div>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item, index) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              to={item.to}
            >
              <span className="nav-index">{String(index + 1).padStart(2, "0")}</span>
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-foot muted">Plan · Link · Explain · Act</div>
      </aside>
      <main className="main-content">
        <div className="main-surface">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
