import mongoose from "mongoose";

const classSessionSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject", required: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    classroom: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
    /** Set when class is started from the room kiosk; attendance duration uses this instead of scheduled startTime. */
    kioskStartTime: { type: Date },
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
  },
  { timestamps: true }
);

classSessionSchema.index({ courseId: 1, status: 1 });
classSessionSchema.index({ facultyId: 1 });

export const ClassSession = mongoose.model("ClassSession", classSessionSchema);
