import bcrypt from "bcryptjs";
import { User } from "../models/User.js";

/**
 * Creates the first admin user when the database has no admins (e.g. fresh DB).
 * Credentials come from env; override in production. No HTTP endpoint — avoids public admin registration.
 */
export async function ensureDefaultAdmin() {
  if (process.env.SEED_DEFAULT_ADMIN === "false" || process.env.SEED_DEFAULT_ADMIN === "0") {
    return;
  }
  const existing = await User.exists({ role: "admin" });
  if (existing) return;

  const email = (process.env.SEED_ADMIN_EMAIL || "admin@ddn.upes.ac.in").trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD || "admin@123";
  const name = (process.env.SEED_ADMIN_NAME || "System Admin").trim();

  const passwordHash = await bcrypt.hash(password, 10);
  await User.create({
    name,
    email,
    passwordHash,
    role: "admin",
    faceEmbedding: [],
    faceGallery: [],
  });
  console.log(`[seed] Created default admin: ${email} (set SEED_DEFAULT_ADMIN=0 to disable; change password after first login)`);
}
