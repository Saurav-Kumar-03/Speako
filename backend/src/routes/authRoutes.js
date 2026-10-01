import express from "express";
import { signup, verifyOtp, resendOtp, login, logout, onboard } from "../controllers/authController.js";
import { protectRoute } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/signup", signup);
router.post("/verify-otp", verifyOtp);
router.post("/resend-otp", resendOtp);
router.post("/login", login);
router.post("/Login", login);
router.post("/logout", logout);
router.post("/Logout", logout);

router.post("/onboarding", protectRoute, onboard);
router.get("/me", protectRoute, (req, res) => {
  return res.status(200).json({ success: true, user: req.user });
});

export default router;