import mongoose from "mongoose";

const courseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true },
    facultyId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  },
  { timestamps: true }
);

courseSchema.index({ facultyId: 1 });

export const Course = mongoose.model("Course", courseSchema);
