import mongoose from "mongoose";

const pendingUserSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      required: true,
      trim: true,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: {
      type: String,
      required: true,
    },
    otpHash: {
      type: String,
      required: true,
    },
    otpExpiresAt: {
      type: Date,
      required: true,
    },
    otpAttempts: {
      type: Number,
      default: 0,
      min: 0,
    },
    lastOtpSentAt: {
      type: Date,
      default: Date.now,
    },
    resendCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      expires: 600, // 10 minutes in seconds (MongoDB TTL index)
    },
  },
  {
    timestamps: false,
  }
);

const PendingUser = mongoose.model("PendingUser", pendingUserSchema);

export default PendingUser;
