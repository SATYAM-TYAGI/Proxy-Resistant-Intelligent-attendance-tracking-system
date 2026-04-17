import express from "express";
import { Course } from "../models/Course.js";
import { ClassSession } from "../models/ClassSession.js";
import { Attendance } from "../models/Attendance.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { computeAttendanceMetrics } from "../utils/attendanceCalc.js";

const router = express.Router();
router.use(authRequired);

router.post("/", requireRole("faculty"), express.json(), async (req, res) => {
  const { courseId, date, startTime, endTime } = req.body;
  if (!courseId || !date || !startTime || !endTime) {
    return res.status(400).json({ error: "missing_fields" });
  }
  const course = await Course.findById(courseId);
  if (!course || course.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  const session = await ClassSession.create({
    courseId,
    facultyId: req.user.id,
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
    .sort({ startTime: -1 });
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
    .lean();
  return res.json(active);
});

router.post("/:id/start", requireRole("faculty"), async (req, res) => {
  const s = await ClassSession.findById(req.params.id);
  if (!s || s.facultyId.toString() !== req.user.id) return res.status(404).json({ error: "not_found" });
  await ClassSession.updateMany(
    { courseId: s.courseId, _id: { $ne: s._id }, status: "active" },
    { $set: { status: "inactive" } }
  );
  s.status = "active";
  await s.save();
  return res.json(s);
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
