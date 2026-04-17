import { useCallback, useEffect, useState } from "react";
import api from "../../api/client.js";
import FacultyLayout from "../../components/FacultyLayout.jsx";

export default function FacultyDashboard() {
  const [courses, setCourses] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [courseName, setCourseName] = useState("");
  const [courseCode, setCourseCode] = useState("");
  const [classForm, setClassForm] = useState({ courseId: "", date: "", start: "", end: "" });
  const [selectedSession, setSelectedSession] = useState(null);
  const [summary, setSummary] = useState(null);
  const [courseStudents, setCourseStudents] = useState([]);
  const [manual, setManual] = useState({ studentId: "", present: true });
  const [toast, setToast] = useState(null);

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([api.get("/courses/mine"), api.get("/classes/mine")]);
    setCourses(c.data);
    setSessions(s.data);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Failed to load faculty data." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const createCourse = async (e) => {
    e.preventDefault();
    await api.post("/courses", { name: courseName, code: courseCode || undefined });
    setCourseName("");
    setCourseCode("");
    setToast({ type: "ok", text: "Course created." });
    load();
  };

  const createClass = async (e) => {
    e.preventDefault();
    const { courseId, date, start, end } = classForm;
    if (!courseId || !date || !start || !end) return;
    const startTime = new Date(`${date}T${start}`);
    const endTime = new Date(`${date}T${end}`);
    await api.post("/classes", { courseId, date: startTime.toISOString(), startTime: startTime.toISOString(), endTime: endTime.toISOString() });
    setToast({ type: "ok", text: "Class scheduled." });
    load();
  };

  const startClass = async (id) => {
    await api.post(`/classes/${id}/start`);
    setToast({ type: "ok", text: "Class session activated." });
    load();
  };

  const endClass = async (id) => {
    await api.post(`/classes/${id}/end`);
    setToast({ type: "ok", text: "Class ended — attendance finalized (70% rule applied)." });
    load();
    if (selectedSession === id) loadSummary(id);
  };

  const loadSummary = async (id) => {
    const { data } = await api.get(`/attendance/summary/${id}`);
    setSummary(data);
    const cid = data.session?.courseId?._id || data.session?.courseId;
    if (cid) {
      const c = await api.get(`/courses/${cid}`);
      setCourseStudents(c.data.studentIds || []);
    }
  };

  const openSession = (id) => {
    setSelectedSession(id);
    loadSummary(id).catch(() => setToast({ type: "err", text: "Could not load session summary." }));
  };

  const submitManual = async (e) => {
    e.preventDefault();
    if (!selectedSession || !manual.studentId) return;
    await api.post("/attendance/manual", {
      classSessionId: selectedSession,
      studentId: manual.studentId,
      present: manual.present,
    });
    setToast({ type: "ok", text: "Manual attendance saved." });
    loadSummary(selectedSession);
  };

  return (
    <FacultyLayout title="Faculty dashboard">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Courses</h3>
          <form onSubmit={createCourse}>
            <div className="field">
              <label>Course name</label>
              <input className="input" value={courseName} onChange={(e) => setCourseName(e.target.value)} required />
            </div>
            <div className="field">
              <label>Code (optional)</label>
              <input className="input" value={courseCode} onChange={(e) => setCourseCode(e.target.value)} />
            </div>
            <button className="btn btn-primary" type="submit">
              Add course
            </button>
          </form>
          <ul style={{ marginTop: "1rem", paddingLeft: "1.1rem" }}>
            {courses.map((c) => (
              <li key={c._id}>
                <strong>{c.name}</strong> <span className="mono muted" style={{ fontSize: "0.8rem" }}>{c._id}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3>Schedule a class</h3>
          <form onSubmit={createClass}>
            <div className="field">
              <label>Course</label>
              <select className="input" value={classForm.courseId} onChange={(e) => setClassForm({ ...classForm, courseId: e.target.value })} required>
                <option value="">Select…</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Date</label>
              <input className="input" type="date" value={classForm.date} onChange={(e) => setClassForm({ ...classForm, date: e.target.value })} required />
            </div>
            <div className="grid-2" style={{ gap: "0.75rem" }}>
              <div className="field">
                <label>Start</label>
                <input className="input" type="time" value={classForm.start} onChange={(e) => setClassForm({ ...classForm, start: e.target.value })} required />
              </div>
              <div className="field">
                <label>End</label>
                <input className="input" type="time" value={classForm.end} onChange={(e) => setClassForm({ ...classForm, end: e.target.value })} required />
              </div>
            </div>
            <button className="btn btn-primary" type="submit">
              Create class
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Class sessions</h3>
        <p className="muted">Start a session while teaching; students only see “Mark attendance” when status is active.</p>
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Course</th>
                <th>Start</th>
                <th>End</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((s) => (
                <tr key={s._id}>
                  <td>{s.courseId?.name}</td>
                  <td className="muted">{new Date(s.startTime).toLocaleString()}</td>
                  <td className="muted">{new Date(s.endTime).toLocaleString()}</td>
                  <td>
                    <span className={`badge ${s.status === "active" ? "success" : "warn"}`}>{s.status}</span>
                  </td>
                  <td>
                    <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
                      <button type="button" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => startClass(s._id)}>
                        Start
                      </button>
                      <button type="button" className="btn btn-danger" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => endClass(s._id)}>
                        End
                      </button>
                      <button type="button" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => openSession(s._id)}>
                        Summary
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!sessions.length && <p className="muted">No sessions yet.</p>}
        </div>
      </div>

      {selectedSession && summary && (
        <div className="card" style={{ marginTop: "1rem" }}>
          <h3>Session summary</h3>
          <p className="muted mono">Session ID: {selectedSession}</p>
          <table>
            <thead>
              <tr>
                <th>Student</th>
                <th>SAP</th>
                <th>Entry</th>
                <th>Exit</th>
                <th>%</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {summary.rows?.map((r) => (
                <tr key={r._id}>
                  <td>{r.studentId?.name}</td>
                  <td>{r.studentId?.sapId}</td>
                  <td className="muted">{r.entryTime ? new Date(r.entryTime).toLocaleTimeString() : "—"}</td>
                  <td className="muted">{r.exitTime ? new Date(r.exitTime).toLocaleTimeString() : "—"}</td>
                  <td>{r.attendancePercentage ?? "—"}</td>
                  <td>
                    <span className={`badge ${r.status === "present" ? "success" : r.status === "absent" ? "danger" : "warn"}`}>{r.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <h4 style={{ marginTop: "1.25rem" }}>Manual attendance</h4>
          <form onSubmit={submitManual} style={{ display: "flex", flexWrap: "wrap", gap: "0.75rem", alignItems: "flex-end" }}>
            <div className="field" style={{ margin: 0, minWidth: 220 }}>
              <label>Student</label>
              <select className="input" value={manual.studentId} onChange={(e) => setManual({ ...manual, studentId: e.target.value })} required>
                <option value="">Select…</option>
                {courseStudents.map((st) => (
                  <option key={st._id} value={st._id}>
                    {st.name} ({st.sapId})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label>Mark as</label>
              <select className="input" value={manual.present ? "p" : "a"} onChange={(e) => setManual({ ...manual, present: e.target.value === "p" })}>
                <option value="p">Present</option>
                <option value="a">Absent</option>
              </select>
            </div>
            <button className="btn btn-primary" type="submit">
              Save
            </button>
          </form>
        </div>
      )}
    </FacultyLayout>
  );
}
