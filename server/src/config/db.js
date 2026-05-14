import mongoose from "mongoose";

/**
 * Normalize Railway / shell pasted connection strings.
 * Supports MONGODB_URI or MONGODB_URL (some dashboards use URL).
 */
export function resolveMongoUri() {
  const raw = process.env.MONGODB_URI || process.env.MONGODB_URL || "";
  let uri = String(raw).trim();
  if ((uri.startsWith('"') && uri.endsWith('"')) || (uri.startsWith("'") && uri.endsWith("'"))) {
    uri = uri.slice(1, -1).trim();
  }
  return uri;
}

function srvHost(uri) {
  const m = uri.match(/^mongodb\+srv:\/\/[^@]*@([^/?#]+)/i);
  return m ? m[1].toLowerCase() : null;
}

export async function connectDb(uri) {
  const u = String(uri || "").trim();
  if (!u) {
    throw new Error("Missing MONGODB_URI (or MONGODB_URL). Set it in Railway Variables.");
  }

  if (u.startsWith("mongodb+srv://")) {
    const host = srvHost(u);
    if (!host || host.length < 4 || !host.includes(".")) {
      throw new Error(
        `Invalid mongodb+srv host "${host || ""}". After @ you need your full Atlas hostname, e.g. cluster0.abcd123.mongodb.net — not a short placeholder.`
      );
    }
    if (/^[0-9.]+$/.test(host) || host === "localhost") {
      throw new Error(
        `mongodb+srv cannot use "${host}". Use the hostname from Atlas (Connect → Drivers), or switch to a standard mongodb:// connection string.`
      );
    }
  }

  mongoose.set("strictQuery", true);
  await mongoose.connect(u);
}
