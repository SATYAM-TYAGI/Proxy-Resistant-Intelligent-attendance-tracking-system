import { NavLink } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";

export default function StudentLayout({ children, title }) {
  const { user, logout } = useAuth();
  return (
    <div className="layout">
      <aside className="sidebar">
        <div className="brand">PRATS · Student</div>
        <NavLink to="/student" end>
          Dashboard
        </NavLink>
        <button type="button" className="btn btn-ghost" style={{ marginTop: "auto", width: "100%" }} onClick={logout}>
          Log out
        </button>
      </aside>
      <div className="main">
        <div className="topbar">
          <div>
            <h2 style={{ margin: 0 }}>{title}</h2>
            <p className="muted" style={{ margin: 0 }}>
              {user?.name} · SAP {user?.sapId}
            </p>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}
