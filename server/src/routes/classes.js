import express from "express";
import { Course } from "../models/Course.js";
import { ClassSession } from "../models/ClassSession.js";
import { Subject } from "../models/Subject.js";
import { Attendance } from "../models/Attendance.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { computeAttendanceMetrics } from "../utils/attendanceCalc.js";

const router = express.Router();
router.use(authRequired);

function startEndOfLocalDay(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

router.post("/", requireRole("faculty"), express.json(), async (req, res) => {
  const { courseId, subjectId, classroom, date, startTime, endTime } = req.body;
  if (!courseId || !subjectId || !classroom || !date || !startTime || !endTime) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const course = await Course.findById(courseId);
  if (!course || course.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  const subject = await Subject.findOne({ _id: subjectId, courseId: course._id });
  if (!subject) {
    return res.status(400).json({ error: "invalid_subject" });
  }
  const session = await ClassSession.create({
    courseId,
    subjectId,
    facultyId: req.user.id,
    classroom: String(classroom).trim(),
    date: new Date(date),
    startTime: new Date(startTime),
    endTime: new Date(endTime),
    status: "inactive",
  });
  return res.json(session);
});

router.get("/mine", requireRole("faculty"), async (req, res) => {
  const list = await ClassSession.find({ facultyId: req.user.id })
    .populate("courseId", "name code")
    .populate("subjectId", "name code")
    .sort({ startTime: -1 });
  return res.json(list);
});

router.get("/upcoming", requireRole("student"), async (req, res) => {
  const courses = await Course.find({ studentIds: req.user.id });
  const ids = courses.map((c) => c._id);
  const from = new Date();
  const list = await ClassSession.find({
    courseId: { $in: ids },
    endTime: { $gte: from },
  })
    .populate("courseId", "name code")
    .populate("subjectId", "name code")
    .sort({ startTime: 1 })
    .limit(200)
    .lean();
  return res.json(list);
});

router.get("/today", async (req, res) => {
  const { start, end } = startEndOfLocalDay(req.query.date ? new Date(String(req.query.date)) : new Date());
  let courseFilter;
  if (req.user.role === "student") {
    courseFilter = { studentIds: req.user.id };
  } else if (req.user.role === "faculty") {
    courseFilter = { facultyId: req.user.id };
  } else {
    return res.json([]);
  }
  const courses = await Course.find(courseFilter);
  const ids = courses.map((c) => c._id);
  const list = await ClassSession.find({
    courseId: { $in: ids },
    startTime: { $gte: start, $lt: end },
  })
    .populate("courseId", "name code")
    .populate("subjectId", "name code")
    .sort({ startTime: 1 })
    .lean();
  return res.json(list);
});

router.get("/active", async (req, res) => {
  const courses = await Course.find(
    req.user.role === "student" ? { studentIds: req.user.id } : { facultyId: req.user.id }
  );
  const ids = courses.map((c) => c._id);
  const active = await ClassSession.find({
    courseId: { $in: ids },
    status: "active",
  })
    .populate("courseId", "name code")
    .populate("subjectId", "name code")
    .lean();
  return res.json(active);
});

router.post("/:id/end", requireRole("faculty"), async (req, res) => {
  const s = await ClassSession.findById(req.params.id);
  if (!s || s.facultyId.toString() !== req.user.id) return res.status(404).json({ error: "not_found" });
  s.status = "inactive";
  await s.save();

  const records = await Attendance.find({ classSessionId: s._id });
  for (const r of records) {
    const m = computeAttendanceMetrics(s, r.entryTime, r.exitTime);
    r.plannedDurationMs = m.plannedDurationMs;
    r.attendedDurationMs = m.attendedDurationMs;
    r.attendancePercentage = m.attendancePercentage;
    r.status = r.manualOverride ? "present" : m.status;
    await r.save();
  }
  return res.json({ ok: true, session: s });
});

export default router;
