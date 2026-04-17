import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterFaculty() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [name, setName] = useState("");
  const [facultyId, setFacultyId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [selfie, setSelfie] = useState(null);
  const [video, setVideo] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!selfie || !video) {
      setErr("Please upload both selfie and video.");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("facultyId", facultyId);
    fd.append("email", email);
    fd.append("password", password);
    fd.append("selfie", selfie);
    fd.append("video", video);
    try {
      const { data } = await axios.post("/api/auth/register/faculty", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      login(data.token, data.user);
      nav("/faculty");
    } catch (ex) {
      const code = ex.response?.data?.error;
      if (code === "duplicate_user") setErr("Email or Faculty ID already registered.");
      else if (code === "ai_service_unavailable") setErr("AI service is offline. Start the Python service first.");
      else setErr("Registration failed. Check inputs and try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="main" style={{ maxWidth: 520, paddingTop: "2rem" }}>
      <Link to="/" className="muted">
        ← Back
      </Link>
      <div className="card" style={{ marginTop: "1rem" }}>
        <h2>Faculty registration</h2>
        <p className="muted">Face samples are stored for future extensions; attendance marking is student-facing.</p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>Faculty ID</label>
            <input className="input" value={facultyId} onChange={(e) => setFacultyId(e.target.value)} required />
          </div>
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
          <div className="field">
            <label>Selfie</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
          </div>
          <div className="field">
            <label>Short video</label>
            <input className="input" type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
          </div>
          {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Registering…" : "Create faculty account"}
          </button>
        </form>
      </div>
    </div>
  );
}
