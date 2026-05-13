import mongoose from "mongoose";

const proxyAttemptSchema = new mongoose.Schema(
  {
    classSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSession", required: true, index: true },
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    reason: {
      type: String,
      enum: ["liveness_failed", "unknown_face", "identity_mismatch"],
      required: true,
    },
    /** AI best-guess SAP / id when no logged-in student (kiosk anonymous). */
    guessSapId: { type: String, default: "" },
    screenshotBase64: { type: String, default: "" },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

export const ProxyAttempt = mongoose.model("ProxyAttempt", proxyAttemptSchema);
