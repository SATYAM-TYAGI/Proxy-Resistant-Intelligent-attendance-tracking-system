import { useCallback, useEffect, useState } from "react";
import api from "../api/client.js";
import AdminLayout from "../components/AdminLayout.jsx";

export default function AdminDashboard() {
  const [pending, setPending] = useState([]);
  const [courses, setCourses] = useState([]);
  const [kioskDevices, setKioskDevices] = useState([]);
  const [kioskDrafts, setKioskDrafts] = useState({});
  const [toast, setToast] = useState(null);
  const [facultyForm, setFacultyForm] = useState({
    name: "",
    facultyId: "",
    email: "",
    password: "",
    selfie: null,
    video: null,
  });

  const load = useCallback(async () => {
    const [e, c, k] = await Promise.all([
      api.get("/admin/enrollments/pending"),
      api.get("/admin/courses"),
      api.get("/admin/kiosk-devices"),
    ]);
    setPending(e.data);
    setCourses(c.data);
    setKioskDevices(k.data);
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Failed to load admin data." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const approve = async (id) => {
    await api.post(`/admin/enrollments/${id}/approve`, {});
    setToast({ type: "ok", text: "Enrollment approved." });
    load();
  };

  const reject = async (id) => {
    await api.post(`/admin/enrollments/${id}/reject`, {});
    setToast({ type: "ok", text: "Enrollment rejected." });
    load();
  };

  const approveKiosk = async (id) => {
    const classroom = String(kioskDrafts[id] || "").trim();
    if (!classroom) {
      setToast({ type: "err", text: "Enter the classroom label exactly as faculty use when scheduling (e.g. Hall A-101)." });
      return;
    }
    try {
      await api.post(`/admin/kiosk-devices/${id}/approve`, { classroom });
      setToast({ type: "ok", text: "Tablet approved for that classroom." });
      setKioskDrafts((p) => {
        const n = { ...p };
        delete n[id];
        return n;
      });
      load();
    } catch {
      setToast({ type: "err", text: "Could not approve device." });
    }
  };

  const revokeKiosk = async (id) => {
    try {
      await api.post(`/admin/kiosk-devices/${id}/revoke`, {});
      setToast({ type: "ok", text: "Device unlinked — it must be approved again." });
      load();
    } catch {
      setToast({ type: "err", text: "Could not revoke device." });
    }
  };

  const addFaculty = async (e) => {
    e.preventDefault();
    const { name, facultyId, email, password, selfie, video } = facultyForm;
    if (!selfie || !video) {
      setToast({ type: "err", text: "Selfie and video are required." });
      return;
    }
    const fd = new FormData();
    fd.append("name", name);
    fd.append("facultyId", facultyId);
    fd.append("email", email);
    fd.append("password", password);
    fd.append("selfie", selfie);
    fd.append("video", video);
    try {
      await api.post("/admin/faculty", fd);
      setToast({ type: "ok", text: "Faculty member created." });
      setFacultyForm({ name: "", facultyId: "", email: "", password: "", selfie: null, video: null });
    } catch (ex) {
      const code = ex.response?.data?.error;
      const msg = ex.response?.data?.message;
      if (code === "duplicate_user") setToast({ type: "err", text: "Email or faculty ID already in use." });
      else if (code === "ai_service_unavailable") setToast({ type: "err", text: "AI service offline. Start the Python service (port 8000)." });
      else if (code === "missing_fields" || code === "missing_files") setToast({ type: "err", text: "Fill all fields and attach selfie + video." });
      else if (code === "no_face_in_selfie") setToast({ type: "err", text: "No clear face in selfie." });
      else if (code === "face_extraction_failed") setToast({ type: "err", text: "Face extraction failed. Try clearer selfie/video." });
      else if (code === "server_error") setToast({ type: "err", text: msg || "Server error. Check API logs." });
      else setToast({ type: "err", text: msg || ex.message || "Could not create faculty." });
    }
  };

  return (
    <AdminLayout title="Admin">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3>Pending course requests</h3>
          <p className="muted">Students choose a course at registration; approve to enroll them.</p>
          {!pending.length && <p className="muted">No pending requests.</p>}
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Course</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pending.map((row) => (
                  <tr key={row._id}>
                    <td>
                      {row.studentId?.name} <span className="muted">({row.studentId?.sapId})</span>
                    </td>
                    <td>{row.courseId?.name}</td>
                    <td>
                      <button type="button" className="btn btn-primary" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => approve(row._id)}>
                        Approve
                      </button>{" "}
                      <button type="button" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => reject(row._id)}>
                        Reject
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card">
          <h3>Add faculty member</h3>
          <p className="muted">Faculty accounts are created here (face enrollment for class start verification).</p>
          <form onSubmit={addFaculty}>
            <div className="field">
              <label>Name</label>
              <input className="input" value={facultyForm.name} onChange={(e) => setFacultyForm({ ...facultyForm, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Faculty ID</label>
              <input className="input" value={facultyForm.facultyId} onChange={(e) => setFacultyForm({ ...facultyForm, facultyId: e.target.value })} required />
            </div>
            <div className="field">
              <label>Email</label>
              <input className="input" type="email" value={facultyForm.email} onChange={(e) => setFacultyForm({ ...facultyForm, email: e.target.value })} required />
            </div>
            <div className="field">
              <label>Password</label>
              <input
                className="input"
                type="password"
                value={facultyForm.password}
                onChange={(e) => setFacultyForm({ ...facultyForm, password: e.target.value })}
                required
              />
            </div>
            <div className="field">
              <label>Selfie</label>
              <input
                className="input"
                type="file"
                accept="image/*"
                onChange={(e) => setFacultyForm({ ...facultyForm, selfie: e.target.files?.[0] || null })}
              />
            </div>
            <div className="field">
              <label>Short video</label>
              <input
                className="input"
                type="file"
                accept="video/*"
                onChange={(e) => setFacultyForm({ ...facultyForm, video: e.target.files?.[0] || null })}
              />
            </div>
            <button className="btn btn-primary" type="submit">
              Create faculty
            </button>
          </form>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>Classroom tablets (kiosk devices)</h3>
        <p className="muted">
          Each physical tablet sends a device ID once. Approve it and type the classroom code that must match scheduled sessions
          (same spelling as faculty enter). Teachers and students then use the separate kiosk website on that tablet only.
        </p>
        {!kioskDevices.length && <p className="muted">No devices have registered yet.</p>}
        <div style={{ overflowX: "auto" }}>
          <table>
            <thead>
              <tr>
                <th>Device ID</th>
                <th>Status</th>
                <th>Room</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {kioskDevices.map((d) => (
                <tr key={d._id}>
                  <td className="mono" style={{ maxWidth: 280, wordBreak: "break-all" }}>
                    {d.deviceId}
                  </td>
                  <td>
                    <span className={`badge ${d.status === "approved" ? "success" : "warn"}`}>{d.status}</span>
                  </td>
                  <td>{d.classroom || "—"}</td>
                  <td>
                    {d.status === "pending" ? (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", alignItems: "center" }}>
                        <input
                          className="input"
                          style={{ minWidth: 160, maxWidth: 220 }}
                          placeholder="Classroom label"
                          value={kioskDrafts[d._id] || ""}
                          onChange={(e) => setKioskDrafts((p) => ({ ...p, [d._id]: e.target.value }))}
                        />
                        <button type="button" className="btn btn-primary" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => approveKiosk(d._id)}>
                          Approve
                        </button>
                      </div>
                    ) : (
                      <button type="button" className="btn btn-ghost" style={{ padding: "0.35rem 0.6rem", fontSize: "0.8rem" }} onClick={() => revokeKiosk(d._id)}>
                        Revoke
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>All courses</h3>
        <p className="muted">Reference for approvals — faculty own their courses and subjects.</p>
        <ul style={{ paddingLeft: "1.1rem" }}>
          {courses.map((c) => (
            <li key={c._id}>
              <strong>{c.name}</strong> <span className="muted">{c.code || ""}</span> · Faculty: {c.facultyId?.name || "—"}
            </li>
          ))}
        </ul>
        {!courses.length && <p className="muted">No courses yet.</p>}
      </div>
    </AdminLayout>
  );
}
