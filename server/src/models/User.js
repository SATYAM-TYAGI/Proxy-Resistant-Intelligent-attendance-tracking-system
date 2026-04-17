import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    passwordHash: { type: String, required: true },
    role: { type: String, enum: ["student", "faculty"], required: true },
    sapId: { type: String, sparse: true, unique: true, trim: true },
    facultyId: { type: String, sparse: true, unique: true, trim: true },
    faceEmbedding: { type: [Number], default: [] },
    faceGallery: { type: [[Number]], default: [] },
  },
  { timestamps: true }
);

userSchema.index({ email: 1 });
userSchema.index({ sapId: 1 }, { sparse: true });
userSchema.index({ facultyId: 1 }, { sparse: true });

export const User = mongoose.model("User", userSchema);
