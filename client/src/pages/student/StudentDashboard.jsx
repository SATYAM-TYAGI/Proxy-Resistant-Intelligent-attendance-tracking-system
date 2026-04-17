import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../api/client.js";
import StudentLayout from "../../components/StudentLayout.jsx";

export default function StudentDashboard() {
  const [courses, setCourses] = useState([]);
  const [browse, setBrowse] = useState([]);
  const [active, setActive] = useState([]);
  const [history, setHistory] = useState([]);
  const [enrollId, setEnrollId] = useState("");
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const [c, a, h, b] = await Promise.all([
      api.get("/courses/mine"),
      api.get("/classes/active"),
      api.get("/attendance/history"),
      api.get("/courses/browse"),
    ]);
    setCourses(c.data);
    setActive(a.data);
    setHistory(h.data);
    setBrowse(b.data);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Failed to load dashboard." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const enroll = async () => {
    if (!enrollId) return;
    try {
      await api.post(`/courses/${enrollId}/enroll`);
      setToast({ type: "ok", text: "Enrolled successfully." });
      setEnrollId("");
      load();
    } catch {
      setToast({ type: "err", text: "Could not enroll (invalid id or already enrolled)." });
    }
  };

  const markLeave = async (classSessionId) => {
    try {
      await api.post("/attendance/leave", { classSessionId });
      setToast({ type: "ok", text: "Exit time recorded." });
      load();
    } catch {
      setToast({ type: "err", text: "Could not record leave." });
    }
  };

  return (
    <StudentLayout title="Student dashboard">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Active sessions</h3>
          <p className="muted">Join only when your faculty has started the class.</p>
          {!active.length && <p className="muted">No active class right now.</p>}
          {active.map((s) => (
            <div key={s._id} style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid var(--border)" }}>
              <strong>{s.courseId?.name || "Course"}</strong>
              <div className="muted mono" style={{ fontSize: "0.8rem" }}>
                Session {s._id}
              </div>
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.5rem", flexWrap: "wrap" }}>
                <Link className="btn btn-primary" to={`/student/mark/${s._id}`}>
                  Mark attendance
                </Link>
                <button type="button" className="btn btn-ghost" onClick={() => markLeave(s._id)}>
                  Mark leave
                </button>
              </div>
            </div>
          ))}
        </div>

        <div className="card">
          <h3>Enrolled courses</h3>
          {!courses.length && <p className="muted">You are not enrolled in any course yet.</p>}
          <ul style={{ margin: 0, paddingLeft: "1.1rem" }}>
            {courses.map((c) => (
              <li key={c._id}>
                <strong>{c.name}</strong>
                {c.code ? <span className="muted"> · {c.code}</span> : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Join a course</h3>
        <p className="muted">Paste a course ID from your faculty, or pick from the catalog below.</p>
        <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" }}>
          <input
            className="input"
            style={{ maxWidth: 320 }}
            placeholder="Course ID"
            value={enrollId}
            onChange={(e) => setEnrollId(e.target.value)}
          />
          <button type="button" className="btn btn-ghost" onClick={enroll}>
            Enroll
          </button>
        </div>
        <div style={{ marginTop: "1rem" }}>
          <h4 style={{ fontSize: "0.95rem" }}>Catalog</h4>
          <div className="mono muted" style={{ maxHeight: 160, overflow: "auto" }}>
            {browse.map((c) => (
              <div key={c._id} style={{ marginBottom: "0.35rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "0.25rem 0.5rem", fontSize: "0.8rem" }}
                  onClick={() => setEnrollId(c._id)}
                >
                  Use ID
                </button>{" "}
                {c.name} {c.code ? `(${c.code})` : ""} — <span style={{ color: "var(--accent)" }}>{c._id}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Attendance history</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>When</th>
                <th>%</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row._id}>
                  <td>{row.classSessionId?.courseId?.name || "—"}</td>
                  <td className="muted">{row.classSessionId?.startTime ? new Date(row.classSessionId.startTime).toLocaleString() : "—"}</td>
                  <td>{row.attendancePercentage ?? "—"}</td>
                  <td>
                    <span className={`badge ${row.status === "present" ? "success" : row.status === "absent" ? "danger" : "warn"}`}>
                      {row.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!history.length && <p className="muted">No records yet.</p>}
        </div>
      </div>
    </StudentLayout>
  );
}
