import express from "express";
import { KioskDevice } from "../models/KioskDevice.js";
import { ClassSession } from "../models/ClassSession.js";
import { Attendance } from "../models/Attendance.js";
import { User } from "../models/User.js";
import { ProxyAttempt } from "../models/ProxyAttempt.js";
import { requireApprovedKiosk } from "../middleware/kioskDevice.js";
import { markAttendance } from "../services/aiService.js";
import { computeAttendanceMetrics } from "../utils/attendanceCalc.js";
import { roomsMatch } from "../utils/roomMatch.js";

const router = express.Router();

const MAX_B64 = 450_000;
const FIVE_MIN_MS = 5 * 60 * 1000;

function startEndOfLocalDay(d = new Date()) {
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

function pickScreenshot(frames) {
  if (!Array.isArray(frames) || !frames.length) return "";
  const mid = frames[Math.floor(frames.length / 2)];
  const s = typeof mid === "string" ? mid : "";
  if (s.length > MAX_B64) return s.slice(0, MAX_B64);
  return s;
}

async function logKioskProxy({ classSessionId, studentId, reason, frames, guessSapId = "" }) {
  try {
    await ProxyAttempt.create({
      classSessionId,
      studentId: studentId || undefined,
      reason,
      guessSapId: String(guessSapId || "").slice(0, 64),
      screenshotBase64: pickScreenshot(frames),
      read: false,
    });
  } catch (e) {
    console.error("kiosk_proxy_log_failed", e.message);
  }
}

router.get("/status", async (req, res) => {
  const deviceId = String(req.query.deviceId || "").trim();
  if (!deviceId) return res.status(400).json({ error: "missing_device_id" });
  const row = await KioskDevice.findOne({ deviceId }).lean();
  if (!row) return res.json({ status: "unknown", deviceId });
  return res.json({
    status: row.status,
    classroom: row.classroom || "",
    deviceId: row.deviceId,
  });
});

router.post("/register", express.json(), async (req, res) => {
  const deviceId = String(req.body?.deviceId || "").trim();
  if (!deviceId || deviceId.length > 256) {
    return res.status(400).json({ error: "invalid_device_id" });
  }
  let row = await KioskDevice.findOne({ deviceId });
  if (!row) {
    row = await KioskDevice.create({ deviceId, status: "pending", classroom: "" });
  }
  return res.json({
    status: row.status,
    classroom: row.classroom || "",
    deviceId: row.deviceId,
  });
});

/** No login: all sessions scheduled today in this tablet's room. */
router.get("/sessions-today", requireApprovedKiosk, async (req, res) => {
  const { start, end } = startEndOfLocalDay(req.query.date ? new Date(String(req.query.date)) : new Date());
  const list = await ClassSession.find({
    startTime: { $gte: start, $lt: end },
  })
    .populate("courseId", "name code")
    .populate("subjectId", "name code")
    .populate("facultyId", "name facultyId")
    .sort({ startTime: 1 })
    .lean();

  const filtered = list.filter((s) => roomsMatch(s.classroom, req.kioskClassroom));
  return res.json(filtered);
});

/** Faculty proves identity with face; may begin up to 5 minutes before scheduled start. */
router.post("/start-class", requireApprovedKiosk, express.json(), async (req, res) => {
  const { classSessionId, frames } = req.body || {};
  if (!classSessionId || !Array.isArray(frames) || frames.length < 2) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const session = await ClassSession.findById(classSessionId);
  if (!session) return res.status(404).json({ error: "not_found" });
  if (!roomsMatch(session.classroom, req.kioskDevice.classroom)) {
    return res.status(403).json({ error: "wrong_classroom" });
  }

  const now = Date.now();
  const schedStart = new Date(session.startTime).getTime();
  const schedEnd = new Date(session.endTime).getTime();
  if (now > schedEnd) {
    return res.status(400).json({ error: "session_ended" });
  }
  if (now < schedStart - FIVE_MIN_MS) {
    return res.status(400).json({
      error: "too_early",
      message: "You can start at most 5 minutes before the scheduled start time.",
    });
  }

  if (session.status === "active") {
    return res.status(400).json({ error: "already_active" });
  }

  const faculty = await User.findById(session.facultyId);
  if (!faculty?.facultyId || !faculty.faceEmbedding?.length) {
    return res.status(400).json({ error: "no_faculty_face" });
  }

  let ai;
  try {
    ai = await markAttendance(frames, [
      { sap_id: faculty.facultyId, name: faculty.name, embedding: faculty.faceEmbedding },
    ]);
  } catch (e) {
    console.error(e);
    if (e.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "ai_service_unavailable" });
    }
    return res.status(500).json({ error: "ai_error" });
  }

  if (ai.result !== "success" || ai.sap_id !== faculty.facultyId) {
    await logKioskProxy({
      classSessionId: session._id,
      studentId: null,
      reason: ai.result === "liveness_failed" ? "liveness_failed" : "unknown_face",
      frames,
      guessSapId: ai.sap_id || "",
    });
    return res.status(403).json({ error: "face_verification_failed" });
  }

  await ClassSession.updateMany(
    { courseId: session.courseId, _id: { $ne: session._id }, status: "active" },
    { $set: { status: "inactive" } }
  );

  session.status = "active";
  session.kioskStartTime = new Date(now);
  await session.save();

  const populated = await ClassSession.findById(session._id)
    .populate("courseId", "name code")
    .populate("subjectId", "name code")
    .populate("facultyId", "name facultyId")
    .lean();
  return res.json(populated);
});

/** No login: identify student from face among course roster. */
router.post("/mark-student", requireApprovedKiosk, express.json(), async (req, res) => {
  const { classSessionId, frames } = req.body || {};
  if (!classSessionId || !Array.isArray(frames) || frames.length < 2) {
    return res.status(400).json({ error: "invalid_payload" });
  }

  const session = await ClassSession.findById(classSessionId).populate("courseId");
  if (!session || session.status !== "active") {
    return res.status(400).json({ error: "no_active_class" });
  }
  if (!roomsMatch(session.classroom, req.kioskDevice.classroom)) {
    return res.status(403).json({ error: "wrong_classroom" });
  }

  const course = session.courseId;
  const students = await User.find({
    _id: { $in: course.studentIds },
    role: "student",
    faceEmbedding: { $exists: true, $ne: [] },
  }).select("sapId name faceEmbedding _id");

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
    await logKioskProxy({ classSessionId: session._id, studentId: null, reason: "liveness_failed", frames });
    return res.json({ result: "liveness_failed" });
  }
  if (ai.result === "no_face") {
    return res.json({ result: "no_face", detail: ai.detail });
  }

  if (ai.result !== "success") {
    await logKioskProxy({
      classSessionId: session._id,
      studentId: null,
      reason: "unknown_face",
      frames,
      guessSapId: ai.sap_id || "",
    });
    return res.json({ result: "unknown", confidence: ai.confidence });
  }

  const student = await User.findOne({
    sapId: ai.sap_id,
    role: "student",
    _id: { $in: course.studentIds },
  });

  if (!student) {
    await logKioskProxy({
      classSessionId: session._id,
      studentId: null,
      reason: "unknown_face",
      frames,
      guessSapId: ai.sap_id || "",
    });
    return res.json({ result: "unknown", detail: "not_in_roster" });
  }

  const existing = await Attendance.findOne({ studentId: student._id, classSessionId: session._id });
  if (existing?.entryTime) {
    return res.status(400).json({
      error: "already_marked",
      name: student.name,
      sapId: student.sapId,
    });
  }

  const now = new Date();
  let record = existing;
  if (!record) {
    record = await Attendance.create({
      studentId: student._id,
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
    name: student.name,
    sapId: student.sapId,
    entryTime: record.entryTime,
    attendancePercentage: record.attendancePercentage,
    status: record.status,
  });
});

export default router;
