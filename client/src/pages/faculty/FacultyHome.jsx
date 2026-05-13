import { useCallback, useEffect, useState } from "react";
import api from "../../api/client.js";
import FacultyLayout from "../../components/FacultyLayout.jsx";

export default function FacultyHome() {
  const [sessions, setSessions] = useState([]);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/classes/mine");
    setSessions(data);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Could not load timetable." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const endClass = async (id) => {
    try {
      await api.post(`/classes/${id}/end`);
      setToast({ type: "ok", text: "Class ended." });
      load();
    } catch {
      setToast({ type: "err", text: "Could not end class." });
    }
  };

  const upcoming = [...sessions].sort((a, b) => new Date(a.startTime) - new Date(b.startTime));

  return (
    <FacultyLayout title="Timetable">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="card">
        <p className="muted" style={{ marginTop: 0 }}>
          Your scheduled sessions. Start a class from the <strong>room tablet</strong> (face only, no login there). End a session here
          when the slot is over.
        </p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Subject / Course</th>
                <th>Room</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {upcoming.map((s) => (
                <tr key={s._id}>
                  <td>
                    {s.subjectId?.name || "—"} · {s.courseId?.name}
                  </td>
                  <td>{s.classroom}</td>
                  <td className="muted">{new Date(s.startTime).toLocaleString()}</td>
                  <td className="muted">{new Date(s.endTime).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${s.status === "active" ? "success" : "warn"}`}>{s.status}</span>
                  </td>
                  <td>
                    {s.status === "active" && (
                      <button type="button" className="btn btn-danger" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => endClass(s._id)}>
                        End class
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessions.length && <p className="muted">No sessions scheduled yet.</p>}
        </div>
      </div>
    </FacultyLayout>
  );
}
