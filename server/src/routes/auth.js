import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import multer from "multer";
import { User } from "../models/User.js";
import { extractRegistrationMultipart } from "../services/aiService.js";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024 },
});

const router = express.Router();

function signToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
}

router.post("/register/student", upload.fields([{ name: "selfie", maxCount: 1 }, { name: "video", maxCount: 1 }]), async (req, res) => {
  try {
    const { name, sapId, email, password } = req.body;
    if (!name || !sapId || !email || !password) {
      return res.status(400).json({ error: "missing_fields" });
    }
    const selfie = req.files?.selfie?.[0];
    const video = req.files?.video?.[0];
    if (!selfie || !video) {
      return res.status(400).json({ error: "missing_files" });
    }
    const exists = await User.findOne({ $or: [{ email }, { sapId }] });
    if (exists) return res.status(409).json({ error: "duplicate_user" });

    const ai = await extractRegistrationMultipart(selfie.buffer, video.buffer);
    if (!ai.ok) return res.status(400).json({ error: ai.error || "face_extraction_failed" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      sapId: String(sapId).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: "student",
      faceEmbedding: ai.primary_embedding,
      faceGallery: ai.gallery_embeddings || [],
    });
    const token = signToken(user);
    return res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        role: user.role,
        sapId: user.sapId,
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

router.post("/register/faculty", upload.fields([{ name: "selfie", maxCount: 1 }, { name: "video", maxCount: 1 }]), async (req, res) => {
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
    const exists = await User.findOne({ $or: [{ email }, { facultyId: String(facultyId).trim() }] });
    if (exists) return res.status(409).json({ error: "duplicate_user" });

    const ai = await extractRegistrationMultipart(selfie.buffer, video.buffer);
    if (!ai.ok) return res.status(400).json({ error: ai.error || "face_extraction_failed" });

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      facultyId: String(facultyId).trim(),
      email: String(email).trim().toLowerCase(),
      passwordHash,
      role: "faculty",
      faceEmbedding: ai.primary_embedding,
      faceGallery: ai.gallery_embeddings || [],
    });
    const token = signToken(user);
    return res.json({
      token,
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

router.post("/login", express.json(), async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: "missing_fields" });
  const user = await User.findOne({ email: String(email).trim().toLowerCase() });
  if (!user) return res.status(401).json({ error: "invalid_credentials" });
  const ok = await bcrypt.compare(password, user.passwordHash);
  if (!ok) return res.status(401).json({ error: "invalid_credentials" });
  const token = signToken(user);
  return res.json({
    token,
    user: {
      id: user._id,
      name: user.name,
      role: user.role,
      sapId: user.sapId,
      facultyId: user.facultyId,
      email: user.email,
    },
  });
});

export default router;
