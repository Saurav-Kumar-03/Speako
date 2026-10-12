import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { upsertStreamUser } from "../lib/stream.js";
import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import PasswordReset from "../models/PasswordReset.js";
import { sendOtpEmail, sendPasswordResetEmail } from "../lib/mail.js";

export async function signup(req, res) {
  const { email, password, fullName } = req.body;
  try {
    if (!email || !password || !fullName) {
      return res.status(400).json({ message: "Please fill in all fields" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const emailParts = normalizedEmail.split("@");
    if (emailParts.length !== 2 || emailParts[1] !== "gmail.com") {
      return res.status(400).json({ message: "Only @gmail.com email addresses are allowed" });
    }

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(400).json({ message: "Email already exists, please use a different email" });
    }

    const existingPending = await PendingUser.findOne({ email: normalizedEmail });
    if (existingPending) {
      const timeSinceLast = Date.now() - new Date(existingPending.lastOtpSentAt).getTime();
      if (timeSinceLast < 60 * 1000) {
        const remainingSeconds = Math.ceil((60 * 1000 - timeSinceLast) / 1000);
        return res.status(429).json({
          message: `A verification code was recently sent. Please wait ${remainingSeconds} seconds before requesting a new code.`,
        });
      }
    }

    // Hash password exactly once with bcrypt
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Generate secure 6-digit OTP using crypto
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    // Upsert pending registration record
    await PendingUser.findOneAndUpdate(
      { email: normalizedEmail },
      {
        fullName: fullName.trim(),
        email: normalizedEmail,
        passwordHash,
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        lastOtpSentAt: new Date(),
        resendCount: 0,
        createdAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    // Send OTP via Nodemailer
    try {
      await sendOtpEmail(normalizedEmail, otp);
    } catch (mailError) {
      console.error("Failed to send OTP email:", mailError.message);
      // Clean up the pending record on mail delivery failure
      await PendingUser.deleteOne({ email: normalizedEmail });
      return res.status(502).json({
        message: "Failed to send verification email. " + mailError.message,
      });
    }

    // Return success without issuing JWT
    return res.status(200).json({
      success: true,
      message: "Verification code sent to your email",
      email: normalizedEmail,
    });
  } catch (error) {
    console.error("Error in signup controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function verifyOtp(req, res) {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    if (cleanOtp.length !== 6) {
      return res.status(400).json({ message: "Verification code must be 6 digits" });
    }

    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });
    if (!pendingUser) {
      return res.status(400).json({
        message: "Verification session expired or not found. Please register again.",
      });
    }

    // Check maximum failed attempts
    if (pendingUser.otpAttempts >= 5) {
      await PendingUser.deleteOne({ _id: pendingUser._id });
      return res.status(400).json({
        message: "Too many failed attempts. Verification session cancelled. Please sign up again.",
      });
    }

    // Check expiration boundary
    if (new Date() > pendingUser.otpExpiresAt) {
      await PendingUser.deleteOne({ _id: pendingUser._id });
      return res.status(400).json({
        message: "Verification code has expired. Please sign up again or request a new code.",
      });
    }

    // Verify OTP using constant-time hash comparison
    const submittedOtpHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");
    const isMatch = crypto.timingSafeEqual(
      Buffer.from(submittedOtpHash, "hex"),
      Buffer.from(pendingUser.otpHash, "hex")
    );

    if (!isMatch) {
      const updatedAttempts = pendingUser.otpAttempts + 1;
      if (updatedAttempts >= 5) {
        await PendingUser.deleteOne({ _id: pendingUser._id });
        return res.status(400).json({
          message: "Too many failed attempts. Verification session cancelled. Please sign up again.",
        });
      }

      await PendingUser.updateOne({ _id: pendingUser._id }, { $inc: { otpAttempts: 1 } });
      const remainingAttempts = 5 - updatedAttempts;
      return res.status(400).json({
        message: `Invalid verification code. ${remainingAttempts} attempts remaining.`,
      });
    }

    // Check if email was registered concurrently in the main User collection
    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      await PendingUser.deleteOne({ _id: pendingUser._id });
      return res.status(400).json({ message: "Email is already registered. Please log in." });
    }

    // Prepare User document with default values and schema validation
    const avatarSeed = Math.random().toString(36).substring(2, 10);
    const randomAvatar = `https://api.dicebear.com/9.x/avataaars/png?seed=${avatarSeed}`;

    const userInstance = new User({
      fullName: pendingUser.fullName,
      email: pendingUser.email,
      password: pendingUser.passwordHash,
      profilePic: randomAvatar,
      bio: "",
      nativeLanguage: "",
      learningLanguage: "",
      location: "",
      isOnboarded: false,
      friends: [],
    });

    // Run full schema validation to verify all rules
    await userInstance.validate();

    // Insert directly into MongoDB collection to bypass pre-save re-hashing
    const userDoc = userInstance.toObject();
    const now = new Date();
    userDoc.createdAt = now;
    userDoc.updatedAt = now;

    await User.collection.insertOne(userDoc);
    const newUser = await User.findById(userInstance._id);

    // Upsert user into GetStream
    try {
      await upsertStreamUser({
        id: newUser._id.toString(),
        name: newUser.fullName,
        image: newUser.profilePic || "",
      });
      console.log(`Stream user created for ${newUser.fullName}`);
    } catch (streamError) {
      console.error("Error creating user in stream:", streamError.message);
    }

    // Delete the pending staging document
    await PendingUser.deleteOne({ _id: pendingUser._id });

    // Generate JWT and set cookie
    const token = jwt.sign(
      { userId: newUser._id, tokenVersion: newUser.tokenVersion || 0 },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: "strict",
      secure: process.env.NODE_ENV === "production",
    });

    return res.status(201).json({ success: true, user: newUser });
  } catch (error) {
    console.error("Error in verifyOtp controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function resendOtp(req, res) {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const pendingUser = await PendingUser.findOne({ email: normalizedEmail });

    if (!pendingUser) {
      return res.status(400).json({
        message: "No pending registration found for this email. Please register again.",
      });
    }

    // Enforce 60-second cooldown
    const timeSinceLast = Date.now() - new Date(pendingUser.lastOtpSentAt).getTime();
    if (timeSinceLast < 60 * 1000) {
      const remainingSeconds = Math.ceil((60 * 1000 - timeSinceLast) / 1000);
      return res.status(429).json({
        message: `Please wait ${remainingSeconds} seconds before requesting a new code.`,
      });
    }

    // Enforce maximum 3 resend attempts
    if (pendingUser.resendCount >= 3) {
      return res.status(429).json({
        message: "Maximum resend attempts reached. Please register again later or check your spam folder.",
      });
    }

    // Generate a fresh 6-digit OTP
    const newOtp = crypto.randomInt(100000, 1000000).toString();
    const newOtpHash = crypto.createHash("sha256").update(newOtp).digest("hex");
    const newExpiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Invalidate previous OTP and update pending record
    pendingUser.otpHash = newOtpHash;
    pendingUser.otpExpiresAt = newExpiresAt;
    pendingUser.otpAttempts = 0; // Reset attempts for the new code
    pendingUser.lastOtpSentAt = new Date();
    pendingUser.resendCount += 1;
    pendingUser.createdAt = new Date(); // Refresh TTL to prevent premature expiration
    await pendingUser.save();

    // Send new OTP email
    try {
      await sendOtpEmail(normalizedEmail, newOtp);
    } catch (mailError) {
      console.error("Error resending OTP email:", mailError.message);
      return res.status(502).json({
        message: "Failed to send verification email. " + mailError.message,
      });
    }

    return res.status(200).json({
      success: true,
      message: "A new verification code has been sent to your email.",
    });
  } catch (error) {
    console.error("Error in resendOtp controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: "All fields are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) return res.status(401).json({ message: "Invalid email or password" });

    const isPasswordCorrect = await user.matchPassword(password);
    if (!isPasswordCorrect) return res.status(401).json({ message: "Invalid email or password" });

    const token = jwt.sign(
      { userId: user._id, tokenVersion: user.tokenVersion || 0 },
      process.env.JWT_SECRET_KEY,
      { expiresIn: "7d" }
    );

    res.cookie("jwt", token, {
      maxAge: 7 * 24 * 60 * 60 * 1000,
      httpOnly: true, // prevent XSS attacks
      sameSite: "strict", // prevent CSRF attacks
      secure: process.env.NODE_ENV === "production",
    });

    res.status(200).json({ success: true, user, message: `Welcome back ${user.fullName}` });
  } catch (error) {
    console.log("Error in login controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export function logout(req, res) {
  res.clearCookie("jwt");
  res.status(200).json({ success: true, message: "Logout successful" });
}

export async function onboard(req, res) {
  try {
    const userId = req.user._id;
    const { fullName, bio, nativeLanguage, learningLanguage, location, profilePic } = req.body;

    // For first-time onboarding, require all basic fields
    if (!req.user.isOnboarded) {
      if (!fullName || !bio || !nativeLanguage || !learningLanguage || !location) {
        return res.status(400).json({
          message: "All fields are required to complete onboarding",
          missingFields: [
            !fullName && "fullName",
            !bio && "bio",
            !nativeLanguage && "nativeLanguage",
            !learningLanguage && "learningLanguage",
            !location && "location",
          ].filter(Boolean),
        });
      }
    }

    const updateFields = {
      isOnboarded: true,
    };

    if (fullName) updateFields.fullName = fullName.trim();
    if (bio !== undefined) updateFields.bio = bio.trim();
    if (nativeLanguage) updateFields.nativeLanguage = nativeLanguage;
    if (learningLanguage) updateFields.learningLanguage = learningLanguage;
    if (location !== undefined) updateFields.location = location.trim();
    if (profilePic !== undefined) updateFields.profilePic = profilePic;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      updateFields,
      { new: true }
    );

    if (!updatedUser) return res.status(404).json({ message: "User not found" });

    try {
      await upsertStreamUser({
        id: updatedUser._id.toString(),
        name: updatedUser.fullName,
        image: updatedUser.profilePic || "",
      });
      console.log(`Stream user updated after onboarding for ${updatedUser.fullName}`);
    } catch (streamError) {
      console.log("Error updating Stream user during onboarding:", streamError.message);
    }

    res.status(200).json({ success: true, user: updatedUser });
  } catch (error) {
    console.log("Error in onboard controller", error.message);
    res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function forgotPassword(req, res) {
  const { email } = req.body;
  try {
    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!emailRegex.test(normalizedEmail)) {
      return res.status(400).json({ message: "Invalid email format" });
    }

    const emailParts = normalizedEmail.split("@");
    if (emailParts.length !== 2 || emailParts[1] !== "gmail.com") {
      return res.status(400).json({ message: "Only @gmail.com email addresses are allowed" });
    }

    const genericResponse = {
      success: true,
      message: "If an account with that email exists, a verification code has been sent.",
      email: normalizedEmail,
    };

    // Check if account exists
    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      // Perform dummy crypto work to mitigate timing-based enumeration attacks
      const dummySalt = crypto.randomBytes(16).toString("hex");
      crypto.createHash("sha256").update(dummySalt).digest("hex");
      return res.status(200).json(genericResponse);
    }

    // Check existing reset session for cooldown and resend limit
    const existingReset = await PasswordReset.findOne({ email: normalizedEmail });
    if (existingReset) {
      const timeSinceLast = Date.now() - new Date(existingReset.lastOtpSentAt).getTime();
      if (timeSinceLast < 60 * 1000) {
        const remainingSeconds = Math.ceil((60 * 1000 - timeSinceLast) / 1000);
        return res.status(429).json({
          message: `A verification code was recently sent. Please wait ${remainingSeconds} seconds before requesting a new code.`,
        });
      }

      if (existingReset.resendCount >= 3) {
        return res.status(429).json({
          message: "Maximum verification code requests reached for this session. Please try again later.",
        });
      }
    }

    // Generate secure 6-digit OTP
    const otp = crypto.randomInt(100000, 1000000).toString();
    const otpHash = crypto.createHash("sha256").update(otp).digest("hex");
    const otpExpiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes expiry

    const resendCount = existingReset ? existingReset.resendCount + 1 : 0;

    await PasswordReset.findOneAndUpdate(
      { email: normalizedEmail },
      {
        email: normalizedEmail,
        otpHash,
        otpExpiresAt,
        otpAttempts: 0,
        lastOtpSentAt: new Date(),
        resendCount,
        resetTokenHash: null,
        resetTokenExpiresAt: null,
        isConsumed: false,
        consumedAt: null,
        createdAt: new Date(),
      },
      { upsert: true, new: true, runValidators: true }
    );

    try {
      await sendPasswordResetEmail(normalizedEmail, otp);
    } catch (mailError) {
      console.error("Failed to send password reset email:", mailError.message);
      await PasswordReset.deleteOne({ email: normalizedEmail });
      return res.status(502).json({
        message: "Failed to send verification email. " + mailError.message,
      });
    }

    return res.status(200).json(genericResponse);
  } catch (error) {
    console.error("Error in forgotPassword controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function verifyResetOtp(req, res) {
  const { email, otp } = req.body;
  try {
    if (!email || !otp) {
      return res.status(400).json({ message: "Email and verification code are required" });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const cleanOtp = otp.toString().trim();

    if (cleanOtp.length !== 6) {
      return res.status(400).json({ message: "Verification code must be 6 digits" });
    }

    const resetSession = await PasswordReset.findOne({ email: normalizedEmail });
    if (!resetSession) {
      return res.status(400).json({
        message: "Verification session expired or not found. Please request a new code.",
      });
    }

    if (resetSession.isConsumed) {
      return res.status(400).json({
        message: "This verification session has already been used. Please request a new code.",
      });
    }

    // Check maximum failed attempts
    if (resetSession.otpAttempts >= 5) {
      await PasswordReset.deleteOne({ _id: resetSession._id });
      return res.status(400).json({
        message: "Too many failed attempts. Reset session cancelled. Please request a new code.",
      });
    }

    // Explicit application-level expiry check
    if (new Date() > resetSession.otpExpiresAt) {
      await PasswordReset.deleteOne({ _id: resetSession._id });
      return res.status(400).json({
        message: "Verification code has expired. Please request a new code.",
      });
    }

    // Verify OTP using constant-time hash comparison
    const submittedOtpHash = crypto.createHash("sha256").update(cleanOtp).digest("hex");
    let isMatch = false;
    try {
      isMatch = crypto.timingSafeEqual(
        Buffer.from(submittedOtpHash, "hex"),
        Buffer.from(resetSession.otpHash, "hex")
      );
    } catch {
      isMatch = false;
    }

    if (!isMatch) {
      const updatedAttempts = resetSession.otpAttempts + 1;
      if (updatedAttempts >= 5) {
        await PasswordReset.deleteOne({ _id: resetSession._id });
        return res.status(400).json({
          message: "Too many failed attempts. Reset session cancelled. Please request a new code.",
        });
      }

      await PasswordReset.updateOne({ _id: resetSession._id }, { $inc: { otpAttempts: 1 } });
      const remainingAttempts = 5 - updatedAttempts;
      return res.status(400).json({
        message: `Invalid verification code. ${remainingAttempts} attempts remaining.`,
      });
    }

    // Generate single-use reset authorization token (32 bytes = 64 hex chars)
    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenHash = crypto.createHash("sha256").update(resetToken).digest("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes expiry

    resetSession.resetTokenHash = resetTokenHash;
    resetSession.resetTokenExpiresAt = resetTokenExpiresAt;
    resetSession.otpHash = "used"; // Invalidate OTP so it cannot be reused
    await resetSession.save();

    return res.status(200).json({
      success: true,
      message: "Verification code confirmed.",
      resetToken,
    });
  } catch (error) {
    console.error("Error in verifyResetOtp controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}

export async function resetPassword(req, res) {
  const { resetToken, newPassword } = req.body;
  try {
    if (!resetToken || !newPassword) {
      return res.status(400).json({ message: "Reset token and new password are required" });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters" });
    }

    const cleanToken = resetToken.toString().trim();
    const resetTokenHash = crypto.createHash("sha256").update(cleanToken).digest("hex");

    // Atomically find and consume the reset session (concurrency-safe & genuinely single-use)
    const resetSession = await PasswordReset.findOneAndUpdate(
      {
        resetTokenHash,
        isConsumed: false,
        resetTokenExpiresAt: { $gt: new Date() },
      },
      {
        isConsumed: true,
        consumedAt: new Date(),
      },
      { new: false }
    );

    if (!resetSession) {
      return res.status(400).json({
        message: "Invalid or expired password reset token. Please request a new code.",
      });
    }

    const user = await User.findOne({ email: resetSession.email });
    if (!user) {
      return res.status(404).json({ message: "User account not found" });
    }

    // Update password (plain text so pre-save hook properly hashes with salt)
    // and bump tokenVersion to invalidate all existing user sessions
    user.password = newPassword;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();

    // Clean up reset session
    await PasswordReset.deleteOne({ _id: resetSession._id });

    // Clear any active auth cookie
    res.clearCookie("jwt");

    return res.status(200).json({
      success: true,
      message: "Password reset successfully. Please log in with your new password.",
    });
  } catch (error) {
    console.error("Error in resetPassword controller:", error.message);
    return res.status(500).json({ message: "Internal Server Error" });
  }
}