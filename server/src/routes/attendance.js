import express from "express";
import { Course } from "../models/Course.js";
import { ClassSession } from "../models/ClassSession.js";
import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { ProxyAttempt } from "../models/ProxyAttempt.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { computeAttendanceMetrics } from "../utils/attendanceCalc.js";

const router = express.Router();
router.use(authRequired);

const MAX_SCREENSHOT_B64 = 450_000;

function effectiveStartTime(session) {
  return session.kioskStartTime || session.startTime;
}

function sessionPlannedMs(session) {
  return Math.max(1, new Date(session.endTime).getTime() - new Date(effectiveStartTime(session)).getTime());
}

function pickScreenshot(frames) {
  if (!Array.isArray(frames) || !frames.length) return "";
  const mid = frames[Math.floor(frames.length / 2)];
  const s = typeof mid === "string" ? mid : "";
  if (s.length > MAX_SCREENSHOT_B64) return s.slice(0, MAX_SCREENSHOT_B64);
  return s;
}

async function logProxyAttempt({ classSessionId, studentId, reason, frames, guessSapId = "" }) {
  try {
    const screenshotBase64 = pickScreenshot(frames);
    await ProxyAttempt.create({
      classSessionId,
      studentId: studentId || undefined,
      reason,
      guessSapId: String(guessSapId || "").slice(0, 64),
      screenshotBase64,
      read: false,
    });
  } catch (e) {
    console.error("proxy_attempt_log_failed", e.message);
  }
}

router.post("/leave", requireRole("student"), async (req, res) => {
  const { classSessionId } = req.body;
  if (!classSessionId) return res.status(400).json({ error: "missing_class" });
  const session = await ClassSession.findById(classSessionId);
  if (!session) return res.status(404).json({ error: "not_found" });

  const record = await Attendance.findOne({
    studentId: req.user.id,
    classSessionId,
  });
  if (!record || !record.entryTime) {
    return res.status(400).json({ error: "no_entry" });
  }
  record.exitTime = new Date();
  const m = computeAttendanceMetrics(session, record.entryTime, record.exitTime);
  record.plannedDurationMs = m.plannedDurationMs;
  record.attendedDurationMs = m.attendedDurationMs;
  record.attendancePercentage = m.attendancePercentage;
  if (!record.manualOverride) record.status = m.status;
  await record.save();
  return res.json(record);
});

router.post("/manual", requireRole("faculty"), async (req, res) => {
  const { classSessionId, studentId, present } = req.body;
  if (!classSessionId || !studentId) return res.status(400).json({ error: "missing_fields" });
  const session = await ClassSession.findById(classSessionId);
  if (!session || session.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  const course = await Course.findById(session.courseId);
  if (!course.studentIds.some((id) => id.toString() === studentId)) {
    return res.status(400).json({ error: "student_not_in_course" });
  }

  const planned = sessionPlannedMs(session);
  const effStart = effectiveStartTime(session);
  let record = await Attendance.findOne({ classSessionId, studentId });

  if (present) {
    if (!record) {
      record = await Attendance.create({
        studentId,
        classSessionId,
        manualOverride: true,
        status: "present",
        entryTime: effStart,
        exitTime: session.endTime,
        plannedDurationMs: planned,
        attendedDurationMs: planned,
        attendancePercentage: 100,
      });
    } else {
      record.manualOverride = true;
      record.status = "present";
      record.entryTime = record.entryTime || effStart;
      record.exitTime = session.endTime;
      record.plannedDurationMs = planned;
      record.attendedDurationMs = planned;
      record.attendancePercentage = 100;
      await record.save();
    }
    return res.json(record);
  }

  const now = new Date();
  if (!record) {
    record = await Attendance.create({
      studentId,
      classSessionId,
      manualOverride: true,
      status: "absent",
      entryTime: now,
      exitTime: now,
      plannedDurationMs: planned,
      attendedDurationMs: 0,
      attendancePercentage: 0,
    });
  } else {
    record.manualOverride = true;
    record.status = "absent";
    if (!record.entryTime) record.entryTime = now;
    record.exitTime = record.exitTime || now;
    const m = computeAttendanceMetrics(session, record.entryTime, record.exitTime);
    record.plannedDurationMs = m.plannedDurationMs;
    record.attendedDurationMs = m.attendedDurationMs;
    record.attendancePercentage = m.attendancePercentage;
    record.status = "absent";
    await record.save();
  }
  return res.json(record);
});

router.post("/manual-batch", requireRole("faculty"), express.json(), async (req, res) => {
  const { classSessionId, decisions } = req.body || {};
  if (!classSessionId || !Array.isArray(decisions) || !decisions.length) {
    return res.status(400).json({ error: "invalid_payload" });
  }
  const session = await ClassSession.findById(classSessionId);
  if (!session || session.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  const course = await Course.findById(session.courseId);
  const planned = sessionPlannedMs(session);
  const effStart = effectiveStartTime(session);

  for (const row of decisions) {
    const studentId = row?.studentId;
    const present = Boolean(row?.present);
    if (!studentId || !course.studentIds.some((id) => id.toString() === studentId)) continue;

    let record = await Attendance.findOne({ classSessionId, studentId });
    if (present) {
      if (!record) {
        await Attendance.create({
          studentId,
          classSessionId,
          manualOverride: true,
          status: "present",
          entryTime: effStart,
          exitTime: session.endTime,
          plannedDurationMs: planned,
          attendedDurationMs: planned,
          attendancePercentage: 100,
        });
      } else {
        record.manualOverride = true;
        record.status = "present";
        record.entryTime = record.entryTime || effStart;
        record.exitTime = session.endTime;
        record.plannedDurationMs = planned;
        record.attendedDurationMs = planned;
        record.attendancePercentage = 100;
        await record.save();
      }
    } else {
      const now = new Date();
      if (!record) {
        await Attendance.create({
          studentId,
          classSessionId,
          manualOverride: true,
          status: "absent",
          entryTime: now,
          exitTime: now,
          plannedDurationMs: planned,
          attendedDurationMs: 0,
          attendancePercentage: 0,
        });
      } else {
        record.manualOverride = true;
        record.status = "absent";
        if (!record.entryTime) record.entryTime = now;
        record.exitTime = record.exitTime || now;
        const m = computeAttendanceMetrics(session, record.entryTime, record.exitTime);
        record.plannedDurationMs = m.plannedDurationMs;
        record.attendedDurationMs = m.attendedDurationMs;
        record.attendancePercentage = m.attendancePercentage;
        record.status = "absent";
        await record.save();
      }
    }
  }

  return res.json({ ok: true });
});

router.get("/security/proxy-attempts", requireRole("faculty"), async (req, res) => {
  const mine = await ClassSession.find({ facultyId: req.user.id }).select("_id").lean();
  const ids = mine.map((x) => x._id);
  const list = await ProxyAttempt.find({ classSessionId: { $in: ids } })
    .sort({ createdAt: -1 })
    .limit(80)
    .populate("studentId", "name sapId email")
    .populate({
      path: "classSessionId",
      select: "classroom startTime endTime subjectId courseId",
      populate: [
        { path: "subjectId", select: "name code" },
        { path: "courseId", select: "name code" },
      ],
    })
    .lean();
  return res.json(list);
});

router.post("/security/proxy-attempts/:id/read", requireRole("faculty"), express.json(), async (req, res) => {
  const row = await ProxyAttempt.findById(req.params.id).populate("classSessionId", "facultyId classroom startTime");
  if (!row || !row.classSessionId) return res.status(404).json({ error: "not_found" });
  if (row.classSessionId.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  row.read = true;
  await row.save();
  return res.json({ ok: true });
});

router.get("/history", requireRole("student"), async (req, res) => {
  const list = await Attendance.find({ studentId: req.user.id })
    .populate({
      path: "classSessionId",
      populate: [
        { path: "courseId", select: "name code" },
        { path: "subjectId", select: "name code" },
      ],
    })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return res.json(list);
});

router.get("/my-subject-summary", requireRole("student"), async (req, res) => {
  const rows = await Attendance.find({ studentId: req.user.id })
    .populate({
      path: "classSessionId",
      select: "subjectId courseId",
      populate: [
        { path: "subjectId", select: "name code" },
        { path: "courseId", select: "name code" },
      ],
    })
    .lean();

  const map = new Map();
  for (const row of rows) {
    const sid = row.classSessionId?.subjectId?._id?.toString();
    if (!sid) continue;
    if (!map.has(sid)) {
      map.set(sid, {
        subjectId: row.classSessionId.subjectId._id,
        subjectName: row.classSessionId.subjectId.name,
        subjectCode: row.classSessionId.subjectId.code || "",
        courseName: row.classSessionId.courseId?.name || "",
        courseCode: row.classSessionId.courseId?.code || "",
        total: 0,
        present: 0,
        sumPct: 0,
        n: 0,
      });
    }
    const m = map.get(sid);
    m.total += 1;
    if (row.status === "present") m.present += 1;
    m.sumPct += Number(row.attendancePercentage) || 0;
    m.n += 1;
  }

  const list = [...map.values()].map((x) => ({
    subjectId: x.subjectId,
    subjectName: x.subjectName,
    subjectCode: x.subjectCode,
    courseName: x.courseName,
    courseCode: x.courseCode,
    sessionsRecorded: x.total,
    presentSessions: x.present,
    avgAttendancePercentage: x.n ? Math.round((x.sumPct / x.n) * 100) / 100 : 0,
  }));
  return res.json(list);
});

router.get("/summary/:classSessionId", requireRole("faculty"), async (req, res) => {
  const session = await ClassSession.findById(req.params.classSessionId)
    .populate("subjectId", "name code")
    .populate("courseId", "name code");
  if (!session || session.facultyId.toString() !== req.user.id) {
    return res.status(404).json({ error: "not_found" });
  }
  const course = await Course.findById(session.courseId).populate("studentIds", "name sapId email");
  const rows = await Attendance.find({ classSessionId: session._id })
    .populate("studentId", "name sapId email")
    .lean();
  const enrolledStudents = course?.studentIds || [];
  return res.json({ session, rows, enrolledStudents });
});

export default router;
