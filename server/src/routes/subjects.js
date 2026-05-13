import express from "express";
import { Course } from "../models/Course.js";
import { Subject } from "../models/Subject.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.get("/course/:courseId", authRequired, async (req, res) => {
  const course = await Course.findById(req.params.courseId);
  if (!course) return res.status(404).json({ error: "not_found" });

  if (req.user.role === "admin") {
    const subs = await Subject.find({ courseId: course._id }).sort({ name: 1 });
    return res.json(subs);
  }
  if (req.user.role === "faculty" && course.facultyId.toString() === req.user.id) {
    const subs = await Subject.find({ courseId: course._id }).sort({ name: 1 });
    return res.json(subs);
  }
  if (req.user.role === "student" && course.studentIds.some((id) => id.toString() === req.user.id)) {
    const subs = await Subject.find({ courseId: course._id }).sort({ name: 1 });
    return res.json(subs);
  }
  return res.status(403).json({ error: "forbidden" });
});

router.post("/", authRequired, requireRole("faculty"), express.json(), async (req, res) => {
  const { courseId, name, code } = req.body;
  if (!courseId || !name) return res.status(400).json({ error: "missing_fields" });
  const course = await Course.findById(courseId);
  if (!course || course.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  const sub = await Subject.create({
    courseId,
    name: String(name).trim(),
    code: code ? String(code).trim() : undefined,
  });
  return res.json(sub);
});

export default router;
