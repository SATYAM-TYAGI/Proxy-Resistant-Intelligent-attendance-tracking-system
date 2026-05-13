import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../context/AuthContext.jsx";

export default function RegisterStudent() {
  const { login } = useAuth();
  const nav = useNavigate();
  const [catalog, setCatalog] = useState([]);
  const [name, setName] = useState("");
  const [sapId, setSapId] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [courseId, setCourseId] = useState("");
  const [selfie, setSelfie] = useState(null);
  const [video, setVideo] = useState(null);
  const [err, setErr] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    axios
      .get("/api/courses/catalog")
      .then((r) => setCatalog(r.data))
      .catch(() => setCatalog([]));
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setErr("");
    if (!selfie || !video) {
      setErr("Please upload both selfie and video.");
      return;
    }
    if (!courseId) {
      setErr("Please select a course.");
      return;
    }
    setLoading(true);
    const fd = new FormData();
    fd.append("name", name);
    fd.append("sapId", sapId);
    fd.append("email", email);
    fd.append("password", password);
    fd.append("courseId", courseId);
    fd.append("selfie", selfie);
    fd.append("video", video);
    try {
      const { data } = await axios.post("/api/auth/register/student", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      login(data.token, data.user);
      nav("/student");
    } catch (ex) {
      const code = ex.response?.data?.error;
      if (code === "duplicate_user") setErr("Email or SAP ID already registered.");
      else if (code === "invalid_course") setErr("Selected course is not valid.");
      else if (code === "enrollment_exists") setErr("Enrollment request already exists for this course.");
      else if (code === "ai_service_unavailable") setErr("AI service is offline. Start the Python service first.");
      else if (code === "no_face_in_selfie") setErr("No clear face in selfie.");
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
        <h2>Student registration</h2>
        <p className="muted">
          Choose a course to request. An admin must approve before you are enrolled and can see classes for that course and its
          subjects.
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Course requested</label>
            <select className="input" value={courseId} onChange={(e) => setCourseId(e.target.value)} required>
              <option value="">Select a course…</option>
              {catalog.map((c) => (
                <option key={c._id} value={c._id}>
                  {c.name} {c.code ? `(${c.code})` : ""}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} required />
          </div>
          <div className="field">
            <label>SAP ID</label>
            <input className="input" value={sapId} onChange={(e) => setSapId(e.target.value)} required />
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
            <label>Selfie (jpg/png)</label>
            <input className="input" type="file" accept="image/*" onChange={(e) => setSelfie(e.target.files?.[0] || null)} />
          </div>
          <div className="field">
            <label>Short video (mp4)</label>
            <input className="input" type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
          </div>
          {err && <p style={{ color: "var(--danger)" }}>{err}</p>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ width: "100%" }}>
            {loading ? "Registering…" : "Create account"}
          </button>
        </form>
      </div>
    </div>
  );
}
