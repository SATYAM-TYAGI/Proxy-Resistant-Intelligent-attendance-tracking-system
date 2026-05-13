import mongoose from "mongoose";

const courseEnrollmentSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    reviewedAt: { type: Date },
  },
  { timestamps: true }
);

courseEnrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
courseEnrollmentSchema.index({ status: 1 });

export const CourseEnrollment = mongoose.model("CourseEnrollment", courseEnrollmentSchema);
