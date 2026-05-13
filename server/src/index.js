import "dotenv/config";
import express from "express";
import cors from "cors";
import { connectDb } from "./config/db.js";
import { ensureDefaultAdmin } from "./services/seedAdmin.js";
import authRoutes from "./routes/auth.js";
import courseRoutes from "./routes/courses.js";
import classRoutes from "./routes/classes.js";
import attendanceRoutes from "./routes/attendance.js";
import adminRoutes from "./routes/admin.js";
import subjectRoutes from "./routes/subjects.js";
import kioskRoutes from "./routes/kiosk.js";

const app = express();
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" }));

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.use("/api/auth", authRoutes);
app.use("/api/courses", courseRoutes);
app.use("/api/classes", classRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/subjects", subjectRoutes);
app.use("/api/kiosk", kioskRoutes);

const port = Number(process.env.PORT || 5000);
const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/prats";

connectDb(uri)
  .then(() => ensureDefaultAdmin())
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on http://127.0.0.1:${port}`);
    });
  })
  .catch((err) => {
    console.error("MongoDB connection failed:", err.message);
    process.exit(1);
  });
