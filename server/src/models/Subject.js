import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema(
  {
    courseId: { type: mongoose.Schema.Types.ObjectId, ref: "Course", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
  },
  { timestamps: true }
);

subjectSchema.index({ courseId: 1 });

export const Subject = mongoose.model("Subject", subjectSchema);
