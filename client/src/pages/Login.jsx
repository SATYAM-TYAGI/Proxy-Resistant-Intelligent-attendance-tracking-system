import { useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import api from "../api/client.js";
import { useAuth } from "../context/AuthContext.jsx";

function homeForRole(role) {
  if (role === "admin") return "/admin";
  if (role === "faculty") return "/faculty";
  return "/student";
}

export default function Login() {
  const { login } = useAuth();
  const nav = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    setLoading(true);
    try {
      const { data } = await api.post("/auth/login", { email, password });
      login(data.token, data.user);
      const from = location.state?.from;
      const safe = typeof from === "string" && from.startsWith("/") && !from.startsWith("//");
      nav(safe ? from : homeForRole(data.user.role));
    } catch {
      setErr("Invalid email or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main" style={{ maxWidth: 440, paddingTop: "3rem" }}>
      <Link to="/" className="muted">
        ← Back
      </Link>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>Login</h2>
        <p className="muted">One sign-in for students, faculty, and admins. Your dashboard opens based on your role.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Email</label>
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
          </div>
          <div className="field">
            <label>Password</label>
            <input
              className="input"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Signing in…" : "Login"}
          </button>
        </form>
      </div>
    </div>
  );
}
