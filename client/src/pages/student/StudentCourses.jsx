import { useCallback, useEffect, useState } from "react";
import api from "../../api/client.js";
import StudentLayout from "../../components/StudentLayout.jsx";

export default function StudentCourses() {
  const [enrollments, setEnrollments] = useState([]);
  const [subjectsByCourse, setSubjectsByCourse] = useState({});
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const { data } = await api.get("/courses/my-enrollments");
    setEnrollments(data);
    const approved = data.filter((e) => e.status === "approved" && e.courseId?._id);
    const map = {};
    await Promise.all(
      approved.map(async (row) => {
        const cid = row.courseId._id;
        const { data: subs } = await api.get(`/subjects/course/${cid}`);
        map[cid] = subs;
      })
    );
    setSubjectsByCourse(map);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Failed to load courses." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const approved = enrollments.filter((e) => e.status === "approved");
  const other = enrollments.filter((e) => e.status !== "approved");

  return (
    <StudentLayout title="Courses">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="card">
        <h3 style={{ marginTop: 0 }}>Enrolled courses & subjects</h3>
        <p className="muted">Approved courses and the subjects taught under each one.</p>
        {!approved.length && <p className="muted">No approved enrollments yet.</p>}
        {approved.map((row) => {
          const cid = row.courseId?._id;
          const subs = cid ? subjectsByCourse[cid] : null;
          return (
            <div key={row._id} className="session-row">
              <strong>{row.courseId?.name}</strong> {row.courseId?.code ? <span className="muted">({row.courseId.code})</span> : null}
              <div style={{ marginTop: "0.5rem" }}>
                <span className="muted" style={{ fontSize: "0.85rem" }}>
                  Subjects:
                </span>
                <ul style={{ margin: "0.35rem 0 0", paddingLeft: "1.2rem" }}>
                  {(subs || []).length ? (
                    subs.map((s) => (
                      <li key={s._id}>
                        {s.name} {s.code ? <span className="muted">({s.code})</span> : null}
                      </li>
                    ))
                  ) : (
                    <li className="muted">Loading or none yet…</li>
                  )}
                </ul>
              </div>
            </div>
          );
        })}
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Requests</h3>
        <p className="muted">Pending or rejected course requests.</p>
        {!other.length && <p className="muted">No pending or rejected requests.</p>}
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {other.map((row) => (
                <tr key={row._id}>
                  <td>{row.courseId?.name}</td>
                  <td>
                    <span className={`badge ${row.status === "pending" ? "warn" : "danger"}`}>{row.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </StudentLayout>
  );
}
