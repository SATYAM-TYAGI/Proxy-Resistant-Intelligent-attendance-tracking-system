import { useCallback, useEffect, useMemo, useState } from "react";
import api from "../../api/client.js";
import FacultyLayout from "../../components/FacultyLayout.jsx";

function rowForStudent(rows, studentId) {
  return rows?.find((r) => {
    const sid = r.studentId?._id || r.studentId;
    return sid && String(sid) === String(studentId);
  });
}

function initialPresent(row) {
  if (!row) return false;
  if (row.status === "present") return true;
  if (row.status === "absent") return false;
  return Boolean(row.entryTime);
}

export default function FacultyAttendance() {
  const [sessions, setSessions] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [summary, setSummary] = useState(null);
  const [rosterPresent, setRosterPresent] = useState({});
  const [securityAlerts, setSecurityAlerts] = useState([]);
  const [toast, setToast] = useState(null);

  const loadSessions = useCallback(async () => {
    const { data } = await api.get("/classes/mine");
    setSessions(data);
  }, []);

  const loadAlerts = useCallback(async () => {
    try {
      const { data } = await api.get("/attendance/security/proxy-attempts");
      setSecurityAlerts(data);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    loadSessions().catch(() => setToast({ type: "err", text: "Could not load sessions." }));
    loadAlerts();
    const t = setInterval(loadAlerts, 15000);
    return () => clearInterval(t);
  }, [loadSessions, loadAlerts]);

  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(tm);
  }, [toast]);

  const loadSummary = async (id) => {
    const { data } = await api.get(`/attendance/summary/${id}`);
    setSummary(data);
    const next = {};
    const enrolled = data.enrolledStudents || [];
    const rows = data.rows || [];
    for (const st of enrolled) {
      const sid = String(st._id);
      next[sid] = initialPresent(rowForStudent(rows, sid));
    }
    setRosterPresent(next);
  };

  const selectSession = (id) => {
    setSelectedId(id);
    loadSummary(id).catch(() => setToast({ type: "err", text: "Could not load roster." }));
  };

  const markAlertRead = async (id) => {
    try {
      await api.post(`/attendance/security/proxy-attempts/${id}/read`, {});
      loadAlerts();
    } catch {
      setToast({ type: "err", text: "Could not update alert." });
    }
  };

  const saveRoster = async (e) => {
    e.preventDefault();
    if (!selectedId || !summary?.enrolledStudents?.length) return;
    const decisions = summary.enrolledStudents.map((st) => ({
      studentId: st._id,
      present: Boolean(rosterPresent[String(st._id)]),
    }));
    try {
      await api.post("/attendance/manual-batch", { classSessionId: selectedId, decisions });
      setToast({ type: "ok", text: "Attendance saved for all listed students." });
      loadSummary(selectedId);
      loadSessions();
    } catch {
      setToast({ type: "err", text: "Save failed." });
    }
  };

  const enrolled = summary?.enrolledStudents || [];

  const sessionTitle = useMemo(() => {
    if (!summary?.session) return "";
    const s = summary.session;
    return `${s.subjectId?.name || "Subject"} · ${s.courseId?.name || "Course"}`;
  }, [summary]);

  return (
    <FacultyLayout title="Manage attendance">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem", borderColor: "rgba(185, 28, 28, 0.25)" }}>
        <h3 style={{ marginTop: 0 }}>Security alerts (kiosk)</h3>
        <p className="muted">Possible proxy attempts from the classroom tablet (camera-only check-in).</p>
        {!securityAlerts.filter((a) => !a.read).length && <p className="muted">No unread alerts.</p>}
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {securityAlerts
            .filter((a) => !a.read)
            .map((a) => (
              <div key={a._id} className="card" style={{ boxShadow: "none", background: "#fef2f2" }}>
                <p style={{ margin: "0 0 0.35rem" }}>
                  {a.studentId ? (
                    <>
                      <strong>{a.studentId?.name}</strong> <span className="muted">SAP {a.studentId?.sapId}</span>
                    </>
                  ) : (
                    <strong>Unknown person at kiosk</strong>
                  )}
                  {a.guessSapId ? (
                    <span className="muted" style={{ marginLeft: "0.35rem" }}>
                      (guess: {a.guessSapId})
                    </span>
                  ) : null}
                </p>
                <p className="muted" style={{ margin: "0 0 0.35rem", fontSize: "0.85rem" }}>
                  {a.classSessionId?.subjectId?.name || "Session"} · Room {a.classSessionId?.classroom} ·{" "}
                  {a.reason === "liveness_failed" ? "Liveness failed" : a.reason === "identity_mismatch" ? "ID mismatch" : "Face not matched"}
                </p>
                {a.screenshotBase64 ? (
                  <img
                    alt="capture"
                    src={`data:image/jpeg;base64,${a.screenshotBase64}`}
                    style={{ maxWidth: "min(320px, 100%)", borderRadius: "10px", border: "1px solid var(--border)" }}
                  />
                ) : null}
                <button type="button" className="btn btn-ghost" style={{ marginTop: "0.5rem" }} onClick={() => markAlertRead(a._id)}>
                  Mark reviewed
                </button>
              </div>
            ))}
        </div>
      </div>

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Pick a class session</h3>
          <p className="muted">Choose a session to view every enrolled student and set present / absent.</p>
          <div style={{ maxHeight: 360, overflowY: "auto" }}>
            {sessions.map((s) => (
              <button
                key={s._id}
                type="button"
                className="btn btn-ghost"
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  marginBottom: "0.35rem",
                  borderColor: selectedId === s._id ? "var(--accent)" : undefined,
                }}
                onClick={() => selectSession(s._id)}
              >
                <strong>{s.subjectId?.name}</strong> · {s.courseId?.name}
                <div className="muted" style={{ fontSize: "0.8rem" }}>
                  {new Date(s.startTime).toLocaleString()} · {s.classroom} ·{" "}
                  <span className={s.status === "active" ? "badge success" : "badge warn"}>{s.status}</span>
                </div>
              </button>
            ))}
            {!sessions.length && <p className="muted">No sessions.</p>}
          </div>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Roster & attendance</h3>
          {!selectedId && <p className="muted">Select a session on the left.</p>}
          {selectedId && summary && (
            <>
              <p className="muted">{sessionTitle}</p>
              <form onSubmit={saveRoster}>
                <div style={{ overflowX: "auto" }}>
                  <table>
                    <thead>
                      <tr>
                        <th>Student</th>
                        <th>SAP</th>
                        <th>Present</th>
                        <th>Absent</th>
                      </tr>
                    </thead>
                    <tbody>
                      {enrolled.map((st) => {
                        const sid = String(st._id);
                        return (
                          <tr key={sid}>
                            <td>{st.name}</td>
                            <td className="mono">{st.sapId}</td>
                            <td>
                              <input
                                type="radio"
                                name={`att-${sid}`}
                                checked={rosterPresent[sid] === true}
                                onChange={() => setRosterPresent((p) => ({ ...p, [sid]: true }))}
                              />
                            </td>
                            <td>
                              <input
                                type="radio"
                                name={`att-${sid}`}
                                checked={rosterPresent[sid] === false}
                                onChange={() => setRosterPresent((p) => ({ ...p, [sid]: false }))}
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  {!enrolled.length && <p className="muted">No students enrolled in this course.</p>}
                </div>
                <button className="btn btn-primary" type="submit" style={{ marginTop: "1rem" }} disabled={!enrolled.length}>
                  Save attendance for this session
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </FacultyLayout>
  );
}
