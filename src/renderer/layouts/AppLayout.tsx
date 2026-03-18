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
        <div className="brand">
          <strong>Calendar AI</strong>
          <span>Desktop</span>
        </div>
        <nav className="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              className={({ isActive }) => `nav-item${isActive ? " active" : ""}`}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}
