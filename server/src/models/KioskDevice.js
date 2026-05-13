import mongoose from "mongoose";

const kioskDeviceSchema = new mongoose.Schema(
  {
    deviceId: { type: String, required: true, trim: true, unique: true, index: true },
    classroom: { type: String, default: "", trim: true },
    status: { type: String, enum: ["pending", "approved"], default: "pending", index: true },
    approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    approvedAt: { type: Date },
  },
  { timestamps: true }
);

export const KioskDevice = mongoose.model("KioskDevice", kioskDeviceSchema);
