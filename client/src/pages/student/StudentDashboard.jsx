import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import StudentLayout from "../../components/StudentLayout.jsx";

export default function StudentDashboard() {
  const [upcoming, setUpcoming] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [history, setHistory] = useState([]);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const [u, e, h] = await Promise.all([
      api.get("/classes/upcoming"),
      api.get("/courses/my-enrollments"),
      api.get("/attendance/history"),
    ]);
    setUpcoming(u.data);
    setEnrollments(e.data);
    setHistory(h.data);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Failed to load dashboard." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const markLeave = async (classSessionId) => {
    try {
      await api.post("/attendance/leave", { classSessionId });
      setToast({ type: "ok", text: "Exit time recorded." });
      load();
    } catch {
      setToast({ type: "err", text: "Could not record leave." });
    }
  };

  const stats = useMemo(() => {
    const present = history.filter((row) => row.status === "present").length;
    const absent = history.filter((row) => row.status === "absent").length;
    return { total: history.length, present, absent };
  }, [history]);

  const pending = enrollments.filter((x) => x.status === "pending");
  const rejected = enrollments.filter((x) => x.status === "rejected");

  return (
    <StudentLayout title="Dashboard">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      {(pending.length > 0 || rejected.length > 0) && (
        <div className="card" style={{ marginBottom: "1rem", borderColor: "var(--warning)" }}>
          <h3 style={{ marginTop: 0 }}>Course enrollment</h3>
          {pending.length > 0 && (
            <p className="muted">
              You have <strong>{pending.length}</strong> course request(s) waiting for admin approval.
            </p>
          )}
          {rejected.length > 0 && <p className="muted">Some requests were rejected. Contact your administrator if needed.</p>}
        </div>
      )}

      <div className="dashboard-stats" style={{ marginBottom: "1rem" }}>
        <div className="card stat-card stat-card-total">
          <div className="stat-icon" />
          <div>
            <p className="muted stat-label">Sessions recorded</p>
            <h3 className="stat-value">{stats.total}</h3>
          </div>
        </div>
        <div className="card stat-card stat-card-success">
          <div className="stat-icon" />
          <div>
            <p className="muted stat-label">Present</p>
            <h3 className="stat-value">{stats.present}</h3>
          </div>
        </div>
        <div className="card stat-card stat-card-danger">
          <div className="stat-icon" />
          <div>
            <p className="muted stat-label">Absent</p>
            <h3 className="stat-value">{stats.absent}</h3>
          </div>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Timetable</h3>
        <p className="muted">
          Upcoming classes. Mark attendance on the <strong>classroom tablet</strong> when your teacher starts the session. Use{" "}
          <strong>Mark leave</strong> here after you leave an active class.
        </p>
        {!upcoming.length && <p className="muted">No upcoming classes.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
          {upcoming.map((s) => (
            <div key={s._id} className="session-row">
              <strong>{s.subjectId?.name || "Subject"}</strong> · {s.courseId?.name}
              <div className="muted" style={{ fontSize: "0.85rem" }}>
                {new Date(s.startTime).toLocaleString()} · Room <strong>{s.classroom}</strong> ·{" "}
                <span className={s.status === "active" ? "badge success" : "badge warn"}>{s.status}</span>
              </div>
              {s.status === "active" && (
                <div style={{ marginTop: "0.5rem" }}>
                  <button type="button" className="btn btn-ghost" onClick={() => markLeave(s._id)}>
                    Mark leave
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </StudentLayout>
  );
}
