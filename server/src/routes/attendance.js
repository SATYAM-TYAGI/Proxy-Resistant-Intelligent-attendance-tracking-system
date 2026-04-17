import express from "express";
import { Course } from "../models/Course.js";
import { ClassSession } from "../models/ClassSession.js";
import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { markAttendance } from "../services/aiService.js";
import { computeAttendanceMetrics } from "../utils/attendanceCalc.js";

const router = express.Router();
router.use(authRequired);

router.post("/mark-ai", requireRole("student"), async (req, res) => {
  const { classSessionId, frames } = req.body;
  if (!classSessionId || !Array.isArray(frames) || frames.length < 3) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const session = await ClassSession.findById(classSessionId).populate("courseId");
  if (!session || session.status !== "active") {
    return res.status(400).json({ error: "no_active_class" });
  }
  const course = session.courseId;
  if (!course.studentIds.some((id) => id.toString() === req.user.id)) {
    return res.status(403).json({ error: "not_enrolled" });
  }

  const students = await User.find({
    _id: { $in: course.studentIds },
    role: "student",
    faceEmbedding: { $exists: true, $ne: [] },
  }).select("sapId name faceEmbedding");

  const payload = students
    .filter((u) => u.faceEmbedding?.length)
    .map((u) => ({
      sap_id: u.sapId,
      name: u.name,
      embedding: u.faceEmbedding,
    }));

  if (!payload.length) {
    return res.status(400).json({ error: "no_enrolled_faces" });
  }

  let ai;
  try {
    ai = await markAttendance(frames, payload);
  } catch (e) {
    console.error(e);
    if (e.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "ai_service_unavailable" });
    }
    return res.status(500).json({ error: "ai_error" });
  }

  if (ai.result === "liveness_failed") {
    return res.json({ result: "liveness_failed" });
  }
  if (ai.result === "no_face") {
    return res.json({ result: "no_face", detail: ai.detail });
  }
  if (ai.result === "unknown") {
    return res.json({ result: "unknown", confidence: ai.confidence });
  }
  if (ai.result !== "success") {
    return res.json({ result: "unknown" });
  }

  const me = await User.findById(req.user.id);
  if (!me || me.sapId !== ai.sap_id) {
    return res.json({ result: "unknown", detail: "identity_mismatch" });
  }

  const now = new Date();
  let record = await Attendance.findOne({
    studentId: req.user.id,
    classSessionId: session._id,
  });
  if (!record) {
    record = await Attendance.create({
      studentId: req.user.id,
      classSessionId: session._id,
      entryTime: now,
      status: "pending",
      plannedDurationMs: 0,
    });
  } else if (!record.entryTime) {
    record.entryTime = now;
    await record.save();
  }

  const metrics = computeAttendanceMetrics(session, record.entryTime, record.exitTime);
  record.plannedDurationMs = metrics.plannedDurationMs;
  record.attendedDurationMs = metrics.attendedDurationMs;
  record.attendancePercentage = metrics.attendancePercentage;
  if (!record.manualOverride) {
    record.status = session.status === "active" ? "pending" : metrics.status;
  }
  await record.save();

  return res.json({
    result: "attendance_marked",
    name: ai.name,
    sap_id: ai.sap_id,
    entryTime: record.entryTime,
    attendancePercentage: record.attendancePercentage,
    status: record.status,
  });
});

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

  const planned = Math.max(1, new Date(session.endTime) - new Date(session.startTime));
  let record = await Attendance.findOne({ classSessionId, studentId });

  if (present) {
    if (!record) {
      record = await Attendance.create({
        studentId,
        classSessionId,
        manualOverride: true,
        status: "present",
        entryTime: session.startTime,
        exitTime: session.endTime,
        plannedDurationMs: planned,
        attendedDurationMs: planned,
        attendancePercentage: 100,
      });
    } else {
      record.manualOverride = true;
      record.status = "present";
      record.entryTime = record.entryTime || session.startTime;
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

router.get("/history", requireRole("student"), async (req, res) => {
  const list = await Attendance.find({ studentId: req.user.id })
    .populate({ path: "classSessionId", populate: { path: "courseId", select: "name code" } })
    .sort({ createdAt: -1 })
    .limit(100)
    .lean();
  return res.json(list);
});

router.get("/summary/:classSessionId", requireRole("faculty"), async (req, res) => {
  const session = await ClassSession.findById(req.params.classSessionId).populate("courseId", "name code");
  if (!session || session.facultyId.toString() !== req.user.id) {
    return res.status(404).json({ error: "not_found" });
  }
  const rows = await Attendance.find({ classSessionId: session._id })
    .populate("studentId", "name sapId email")
    .lean();
  return res.json({ session, rows });
});

export default router;
