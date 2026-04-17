import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classSessionId: { type: mongoose.Schema.Types.ObjectId, ref: "ClassSession", required: true },
    entryTime: { type: Date },
    exitTime: { type: Date },
    plannedDurationMs: { type: Number, default: 0 },
    attendedDurationMs: { type: Number, default: 0 },
    attendancePercentage: { type: Number, default: 0 },
    status: { type: String, enum: ["pending", "present", "absent"], default: "pending" },
    manualOverride: { type: Boolean, default: false },
  },
  { timestamps: true }
);

attendanceSchema.index({ studentId: 1, classSessionId: 1 }, { unique: true });

export const Attendance = mongoose.model("Attendance", attendanceSchema);
