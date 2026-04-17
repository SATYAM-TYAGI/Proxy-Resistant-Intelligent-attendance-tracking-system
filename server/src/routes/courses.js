import express from "express";
import { Course } from "../models/Course.js";
import { authRequired, requireRole } from "../middleware/auth.js";

const router = express.Router();

router.use(authRequired);

router.post("/", requireRole("faculty"), express.json(), async (req, res) => {
  const { name, code } = req.body;
  if (!name) return res.status(400).json({ error: "missing_name" });
  const course = await Course.create({
    name: String(name).trim(),
    code: code ? String(code).trim() : undefined,
    facultyId: req.user.id,
  });
  return res.json(course);
});

router.get("/browse", requireRole("student"), async (req, res) => {
  const list = await Course.find().select("name code facultyId").sort({ name: 1 }).lean();
  return res.json(list);
});

router.get("/mine", async (req, res) => {
  if (req.user.role === "faculty") {
    const list = await Course.find({ facultyId: req.user.id }).sort({ createdAt: -1 });
    return res.json(list);
  }
  const list = await Course.find({ studentIds: req.user.id }).sort({ createdAt: -1 });
  return res.json(list);
});

router.get("/:id", async (req, res) => {
  const c = await Course.findById(req.params.id).populate("studentIds", "name sapId email");
  if (!c) return res.status(404).json({ error: "not_found" });
  if (req.user.role === "faculty" && c.facultyId.toString() !== req.user.id) {
    return res.status(403).json({ error: "forbidden" });
  }
  if (req.user.role === "student" && !c.studentIds.some((id) => id.toString() === req.user.id)) {
    return res.status(403).json({ error: "forbidden" });
  }
  return res.json(c);
});

router.post("/:id/enroll", requireRole("student"), async (req, res) => {
  const c = await Course.findById(req.params.id);
  if (!c) return res.status(404).json({ error: "not_found" });
  const sid = req.user.id;
  if (c.studentIds.some((id) => id.toString() === sid)) {
    return res.json(c);
  }
  c.studentIds.push(sid);
  await c.save();
  return res.json(c);
});

export default router;
