import { useCallback, useEffect, useState } from "react";
import api from "../../api/client.js";
import FacultyLayout from "../../components/FacultyLayout.jsx";

export default function FacultyTeaching() {
  const [courses, setCourses] = useState([]);
  const [subjectsByCourse, setSubjectsByCourse] = useState({});
  const [subjectForm, setSubjectForm] = useState({ courseId: "", name: "", code: "" });
  const [classForm, setClassForm] = useState({ courseId: "", subjectId: "", classroom: "", date: "", start: "", end: "" });
  const [toast, setToast] = useState(null);

  const loadSubjects = async (courseId) => {
    if (!courseId || subjectsByCourse[courseId]) return;
    const { data } = await api.get(`/subjects/course/${courseId}`);
    setSubjectsByCourse((prev) => ({ ...prev, [courseId]: data }));
  };

  const load = useCallback(async () => {
    const { data } = await api.get("/courses/mine");
    setCourses(data);
    const subMap = {};
    await Promise.all(
      data.map(async (course) => {
        const { data: subs } = await api.get(`/subjects/course/${course._id}`);
        subMap[course._id] = subs;
      })
    );
    setSubjectsByCourse((prev) => ({ ...prev, ...subMap }));
  }, []);

  useEffect(() => {
    load().catch(() => setToast({ type: "err", text: "Failed to load courses." }));
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const createCourse = async (e) => {
    e.preventDefault();
    const form = e.target;
    await api.post("/courses", { name: form.courseName.value, code: form.courseCode.value || undefined });
    form.reset();
    setToast({ type: "ok", text: "Course created." });
    load();
  };

  const createSubject = async (e) => {
    e.preventDefault();
    const { courseId, name, code } = subjectForm;
    if (!courseId || !name) return;
    await api.post("/subjects", { courseId, name, code: code || undefined });
    setSubjectForm({ courseId: "", name: "", code: "" });
    const { data } = await api.get(`/subjects/course/${courseId}`);
    setSubjectsByCourse((prev) => ({ ...prev, [courseId]: data }));
    setToast({ type: "ok", text: "Subject added." });
  };

  const createClass = async (e) => {
    e.preventDefault();
    const { courseId, subjectId, classroom, date, start, end } = classForm;
    if (!courseId || !subjectId || !classroom || !date || !start || !end) return;
    const startTime = new Date(`${date}T${start}`);
    const endTime = new Date(`${date}T${end}`);
    await api.post("/classes", {
      courseId,
      subjectId,
      classroom,
      date: startTime.toISOString(),
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
    });
    setToast({ type: "ok", text: "Class scheduled." });
  };

  return (
    <FacultyLayout title="Courses & classes">
      {toast && (
        <div className="toast-stack" style={{ position: "fixed" }}>
          <div className={`toast ${toast.type === "ok" ? "ok" : "err"}`}>{toast.text}</div>
        </div>
      )}

      <div className="grid-2">
        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add course</h3>
          <form onSubmit={createCourse}>
            <div className="field">
              <label>Course name</label>
              <input className="input" name="courseName" required />
            </div>
            <div className="field">
              <label>Code (optional)</label>
              <input className="input" name="courseCode" />
            </div>
            <button className="btn btn-primary" type="submit">
              Create course
            </button>
          </form>
          <ul style={{ marginTop: "1rem", paddingLeft: "1.1rem" }}>
            {courses.map((c) => (
              <li key={c._id}>
                <strong>{c.name}</strong> {c.code ? <span className="muted">({c.code})</span> : null}
              </li>
            ))}
          </ul>
        </div>

        <div className="card">
          <h3 style={{ marginTop: 0 }}>Add subject</h3>
          <form onSubmit={createSubject}>
            <div className="field">
              <label>Course</label>
              <select
                className="input"
                value={subjectForm.courseId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSubjectForm({ ...subjectForm, courseId: id });
                  if (id) loadSubjects(id);
                }}
                required
              >
                <option value="">Select…</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Subject name</label>
              <input className="input" value={subjectForm.name} onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })} required />
            </div>
            <div className="field">
              <label>Subject code (optional)</label>
              <input className="input" value={subjectForm.code} onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })} />
            </div>
            <button className="btn btn-primary" type="submit">
              Add subject
            </button>
          </form>
          {subjectForm.courseId && (
            <ul style={{ marginTop: "0.75rem", paddingLeft: "1.1rem" }}>
              {(subjectsByCourse[subjectForm.courseId] || []).map((s) => (
                <li key={s._id}>
                  {s.name} {s.code ? <span className="muted">({s.code})</span> : null}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3 style={{ marginTop: 0 }}>Schedule a class</h3>
        <form onSubmit={createClass}>
          <div className="grid-2" style={{ gap: "1rem" }}>
            <div className="field">
              <label>Course</label>
              <select
                className="input"
                value={classForm.courseId}
                onChange={(e) => {
                  const id = e.target.value;
                  setClassForm({ ...classForm, courseId: id, subjectId: "" });
                  if (id) loadSubjects(id);
                }}
                required
              >
                <option value="">Select…</option>
                {courses.map((c) => (
                  <option key={c._id} value={c._id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <label>Subject</label>
              <select
                className="input"
                value={classForm.subjectId}
                onChange={(e) => setClassForm({ ...classForm, subjectId: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {(subjectsByCourse[classForm.courseId] || []).map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label>Classroom</label>
            <input
              className="input"
              value={classForm.classroom}
              onChange={(e) => setClassForm({ ...classForm, classroom: e.target.value })}
              placeholder="e.g. Hall A-101"
              required
            />
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
            Create class session
          </button>
        </form>
      </div>
    </FacultyLayout>
  );
}
