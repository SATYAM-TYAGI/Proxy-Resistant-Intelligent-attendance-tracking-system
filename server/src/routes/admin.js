import express from "express";
import bcrypt from "bcryptjs";
import multer from "multer";
import { User } from "../models/User.js";
import { Course } from "../models/Course.js";
import { CourseEnrollment } from "../models/CourseEnrollment.js";
import { KioskDevice } from "../models/KioskDevice.js";
import { authRequired, requireRole } from "../middleware/auth.js";
import { extractRegistrationMultipart } from "../services/aiService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

const router = express.Router();
router.use(authRequired);
router.use(requireRole("admin"));

router.post("/faculty", upload.fields([{ name: "selfie", maxCount: 1 }, { name: "video", maxCount: 1 }]), async (req, res) => {
  try {
    const { name, facultyId, email, password } = req.body;
    if (!name || !facultyId || !email || !password) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const selfie = req.files?.selfie?.[0];
    const video = req.files?.video?.[0];
    if (!selfie || !video) {
      return res.status(400).json({ error: "missing_files" });
    }
    const exists = await User.findOne({ $or: [{ email: String(email).trim().toLowerCase() }, { facultyId: String(facultyId).trim() }] });
    if (exists) return res.status(409).json({ error: "duplicate_user" });

    const ai = await extractRegistrationMultipart(selfie.buffer, video.buffer);
    if (!ai.ok) return res.status(400).json({ error: ai.error || "face_extraction_failed" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: String(name).trim(),
      facultyId: String(facultyId).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: "faculty",
      faceEmbedding: ai.primary_embedding,
      faceGallery: ai.gallery_embeddings || [],
    });
    return res.json({
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        facultyId: user.facultyId,
        email: user.email,
      },
    });
  } catch (e) {
    console.error(e);
    if (e.code === "ECONNREFUSED") {
      return res.status(503).json({ error: "ai_service_unavailable" });
    }
    return res.status(500).json({ error: "server_error" });
  }
});

router.get("/enrollments/pending", async (_req, res) => {
  const list = await CourseEnrollment.find({ status: "pending" })
    .populate("studentId", "name sapId email")
    .populate("courseId", "name code")
    .sort({ createdAt: -1 })
    .lean();
  return res.json(list);
});

router.post("/enrollments/:id/approve", express.json(), async (req, res) => {
  const row = await CourseEnrollment.findById(req.params.id);
  if (!row || row.status !== "pending") {
    return res.status(404).json({ error: "not_found" });
  }
  const course = await Course.findById(row.courseId);
  if (!course) return res.status(404).json({ error: "course_missing" });

  row.status = "approved";
  row.reviewedBy = req.user.id;
  row.reviewedAt = new Date();
  await row.save();

  const sid = row.studentId.toString();
  if (!course.studentIds.some((id) => id.toString() === sid)) {
    course.studentIds.push(row.studentId);
    await course.save();
  }
  return res.json(row);
});

router.post("/enrollments/:id/reject", express.json(), async (req, res) => {
  const row = await CourseEnrollment.findById(req.params.id);
  if (!row || row.status !== "pending") {
    return res.status(404).json({ error: "not_found" });
  }
  row.status = "rejected";
  row.reviewedBy = req.user.id;
  row.reviewedAt = new Date();
  await row.save();
  return res.json(row);
});

router.post("/assign-course", express.json(), async (req, res) => {
  const { studentId, courseId } = req.body;
  if (!studentId || !courseId) return res.status(400).json({ error: "missing_fields" });
  const student = await User.findOne({ _id: studentId, role: "student" });
  const course = await Course.findById(courseId);
  if (!student || !course) return res.status(404).json({ error: "not_found" });

  let row = await CourseEnrollment.findOne({ studentId: student._id, courseId: course._id });
  if (!row) {
    row = await CourseEnrollment.create({
      studentId: student._id,
      courseId: course._id,
      status: "approved",
      reviewedBy: req.user.id,
      reviewedAt: new Date(),
    });
  } else {
    row.status = "approved";
    row.reviewedBy = req.user.id;
    row.reviewedAt = new Date();
    await row.save();
  }
  const sid = student._id.toString();
  if (!course.studentIds.some((id) => id.toString() === sid)) {
    course.studentIds.push(student._id);
    await course.save();
  }
  return res.json(row);
});

router.get("/courses", async (_req, res) => {
  const list = await Course.find()
    .populate("facultyId", "name email facultyId")
    .sort({ name: 1 })
    .lean();
  return res.json(list);
});

router.get("/kiosk-devices", async (_req, res) => {
  const list = await KioskDevice.find().sort({ updatedAt: -1 }).lean();
  return res.json(list);
});

router.post("/kiosk-devices/:id/approve", express.json(), async (req, res) => {
  const classroom = String(req.body?.classroom || "").trim();
  if (!classroom) return res.status(400).json({ error: "missing_classroom" });
  const row = await KioskDevice.findById(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  row.status = "approved";
  row.classroom = classroom;
  row.approvedBy = req.user.id;
  row.approvedAt = new Date();
  await row.save();
  return res.json(row);
});

router.post("/kiosk-devices/:id/revoke", express.json(), async (req, res) => {
  const row = await KioskDevice.findById(req.params.id);
  if (!row) return res.status(404).json({ error: "not_found" });
  row.status = "pending";
  row.classroom = "";
  row.approvedBy = undefined;
  row.approvedAt = undefined;
  await row.save();
  return res.json(row);
});

export default router;
