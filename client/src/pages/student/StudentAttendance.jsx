import { useCallback, useEffect, useState } from "react";
import api from "../../api/client.js";
import StudentLayout from "../../components/StudentLayout.jsx";

export default function StudentAttendance() {
  const [history, setHistory] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const [h, s] = await Promise.all([api.get("/attendance/history"), api.get("/attendance/my-subject-summary")]);
    setHistory(h.data);
    setSubjects(s.data);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Could not load attendance." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  return (
    <StudentLayout title="Attendance">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="card" style={{ marginBottom: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Per subject</h3>
        <p className="muted">Average attendance percentage is computed from your recorded sessions for each subject.</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Course</th>
                <th>Sessions</th>
                <th>Present</th>
                <th>Avg %</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => (
                <tr key={String(s.subjectId)}>
                  <td>
                    <strong>{s.subjectName}</strong> {s.subjectCode ? <span className="muted">({s.subjectCode})</span> : null}
                  </td>
                  <td>{s.courseName}</td>
                  <td>{s.sessionsRecorded}</td>
                  <td>{s.presentSessions}</td>
                  <td>{s.avgAttendancePercentage}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!subjects.length && <p className="muted">No attendance data yet.</p>}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Detailed history</h3>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Subject / Course</th>
                <th>Room</th>
                <th>When</th>
                <th>%</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.map((row) => (
                <tr key={row._id}>
                  <td>
                    {row.classSessionId?.subjectId?.name || "—"} · {row.classSessionId?.courseId?.name || "—"}
                  </td>
                  <td>{row.classSessionId?.classroom ?? "—"}</td>
                  <td className="muted">
                    {row.classSessionId?.startTime ? new Date(row.classSessionId.startTime).toLocaleString() : "—"}
                  </td>
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
