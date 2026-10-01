import crypto from "crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { upsertStreamUser } from "../lib/stream.js";
import User from "../models/User.js";
import PendingUser from "../models/PendingUser.js";
import { sendOtpEmail } from "../lib/mail.js";

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
    const idx = Math.floor(Math.random() * 100) + 1;
    const randomAvatar = `https://avatar.iran.liara.run/public/${idx}.png`;

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
    const token = jwt.sign({ userId: newUser._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

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

    const token = jwt.sign({ userId: user?._id }, process.env.JWT_SECRET_KEY, {
      expiresIn: "7d",
    });

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
    const { fullName, bio, nativeLanguage, learningLanguage, location } = req.body;

    if (!fullName || !bio || !nativeLanguage || !learningLanguage || !location) {
      return res.status(400).json({
        message: "All fields are required",
        missingFields: [
          !fullName && "fullName",
          !bio && "bio",
          !nativeLanguage && "nativeLanguage",
          !learningLanguage && "learningLanguage",
          !location && "location",
        ].filter(Boolean),
      });
    }
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        ...req.body,
        isOnboarded: true,
      },
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