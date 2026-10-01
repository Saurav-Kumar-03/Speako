import { ShipWheelIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link } from 'react-router';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { signup, verifyOtp, resendOtp } from '../lib/api';

const SignupPage = () => {
  const queryClient = useQueryClient();

  const savedStep = sessionStorage.getItem("speako_signup_step");
  const savedEmail = sessionStorage.getItem("speako_pending_email");

  const [step, setStep] = useState(savedStep === "2" && savedEmail ? 2 : 1);
  const [pendingEmail, setPendingEmail] = useState(savedEmail || "");
  const [otp, setOtp] = useState("");
  const [countdown, setCountdown] = useState(60);

  const [signupData, setSignupData] = useState({
    fullName: "",
    email: "",
    password: "",
  });

  // 60-second cooldown timer for resend
  useEffect(() => {
    if (step !== 2 || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Step 1: Signup mutation
  const {
    mutate: signupMutation,
    isPending: isSigningUp,
    error: signupError,
  } = useMutation({
    mutationFn: signup,
    onSuccess: (data) => {
      const email = data.email || signupData.email.trim().toLowerCase();
      setPendingEmail(email);
      sessionStorage.setItem("speako_pending_email", email);
      sessionStorage.setItem("speako_signup_step", "2");
      setStep(2);
      setCountdown(60);
      toast.success(data.message || "Verification code sent to your email!");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to start registration");
    },
  });

  // Step 2: Verify OTP mutation
  const {
    mutate: verifyMutation,
    isPending: isVerifying,
    error: verifyError,
  } = useMutation({
    mutationFn: verifyOtp,
    onSuccess: () => {
      toast.success("Email verified successfully! Welcome to Speako.");
      sessionStorage.removeItem("speako_pending_email");
      sessionStorage.removeItem("speako_signup_step");
      queryClient.invalidateQueries({ queryKey: ["authUser"] });
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Verification failed");
    },
  });

  // Resend OTP mutation
  const {
    mutate: resendMutation,
    isPending: isResending,
  } = useMutation({
    mutationFn: resendOtp,
    onSuccess: (data) => {
      toast.success(data.message || "A new verification code has been sent!");
      setCountdown(60);
      setOtp("");
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || "Failed to resend code");
    },
  });

  const handleSignup = (e) => {
    e.preventDefault();
    const normalizedEmail = signupData.email.trim().toLowerCase();
    if (!normalizedEmail.endsWith("@gmail.com")) {
      toast.error("Only @gmail.com email addresses are allowed");
      return;
    }
    signupMutation({
      fullName: signupData.fullName.trim(),
      email: normalizedEmail,
      password: signupData.password,
    });
  };

  const handleVerify = (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      toast.error("Please enter a valid 6-digit verification code");
      return;
    }
    verifyMutation({
      email: pendingEmail,
      otp: cleanOtp,
    });
  };

  const handleResend = () => {
    if (countdown > 0 || isResending) return;
    resendMutation({ email: pendingEmail });
  };

  const handleChangeEmail = () => {
    sessionStorage.removeItem("speako_pending_email");
    sessionStorage.removeItem("speako_signup_step");
    setStep(1);
    setOtp("");
  };

  return (
    <div className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" data-theme="forest">
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-4xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* SIGNUP FORM - LEFT SIDE */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col justify-center">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              Speako
            </span>
          </div>

          {step === 1 ? (
            /* STEP 1: REGISTRATION DETAILS */
            <div className="w-full">
              {/* ERROR MESSAGE IF ANY */}
              {signupError && (
                <div className="alert alert-error mb-4">
                  <span>{signupError.response?.data?.message || "Something went wrong"}</span>
                </div>
              )}

              <form onSubmit={handleSignup}>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Create an Account</h2>
                    <p className="text-sm opacity-70">
                      Join <span className="text-primary">Speako</span> and start your language learning adventure!
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* Full Name */}
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">Name</span>
                      </label>
                      <input
                        type="text"
                        placeholder="Enter Your Name"
                        className="input input-bordered w-full"
                        value={signupData.fullName}
                        onChange={(e) =>
                          setSignupData({ ...signupData, fullName: e.target.value })
                        }
                        required
                      />
                    </div>

                    {/* Email */}
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">Gmail</span>
                      </label>
                      <input
                        type="email"
                        placeholder="Enter Your Gmail (e.g. name@gmail.com)"
                        className="input input-bordered w-full"
                        value={signupData.email}
                        onChange={(e) =>
                          setSignupData({ ...signupData, email: e.target.value })
                        }
                        required
                      />
                    </div>

                    {/* Password */}
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">Password</span>
                      </label>
                      <input
                        type="password"
                        placeholder="Enter Your Password"
                        className="input input-bordered w-full"
                        value={signupData.password}
                        onChange={(e) =>
                          setSignupData({ ...signupData, password: e.target.value })
                        }
                        required
                        minLength={6}
                      />
                      <p className="text-xs opacity-70 mt-1">
                        Password must be at least 6 characters long
                      </p>
                    </div>

                    <div className="form-control">
                      <label className="label cursor-pointer justify-start gap-2">
                        <input type="checkbox" className="checkbox checkbox-sm" required />
                        <span className="text-xs leading-tight">
                          I agree to the{" "}
                          <span className="text-primary hover:underline">terms of service</span> and{" "}
                          <span className="text-primary hover:underline">privacy policy</span>
                        </span>
                      </label>
                    </div>
                  </div>

                  <button className="btn btn-primary w-full" type="submit" disabled={isSigningUp}>
                    {isSigningUp ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Sending Code...
                      </>
                    ) : (
                      "Create Account"
                    )}
                  </button>

                  <div className="text-center mt-4">
                    <p className="text-sm">
                      Already have an account?{" "}
                      <Link to="/login" className="text-primary hover:underline">
                        Sign in
                      </Link>
                    </p>
                  </div>
                </div>
              </form>
            </div>
          ) : (
            /* STEP 2: OTP VERIFICATION */
            <div className="w-full">
              {verifyError && (
                <div className="alert alert-error mb-4">
                  <span>{verifyError.response?.data?.message || "Verification failed"}</span>
                </div>
              )}

              <form onSubmit={handleVerify}>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Verify Your Email</h2>
                    <p className="text-sm opacity-70 mt-1">
                      Verification code sent to:{" "}
                      <span className="font-semibold text-primary">{pendingEmail}</span>
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">6-Digit Verification Code</span>
                      </label>
                      <input
                        type="text"
                        maxLength={6}
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        pattern="\d{6}"
                        placeholder="••••••"
                        className="input input-bordered w-full text-center text-3xl font-mono tracking-widest font-bold focus:border-primary"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ""))}
                        autoFocus
                        required
                      />
                    </div>
                  </div>

                  <button
                    className="btn btn-primary w-full"
                    type="submit"
                    disabled={isVerifying || otp.length !== 6}
                  >
                    {isVerifying ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Verifying...
                      </>
                    ) : (
                      "Verify & Continue"
                    )}
                  </button>

                  <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 text-sm">
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={handleResend}
                      disabled={countdown > 0 || isResending}
                    >
                      {isResending ? (
                        <span className="loading loading-spinner loading-xs"></span>
                      ) : countdown > 0 ? (
                        `Resend Code (${countdown}s)`
                      ) : (
                        "Resend Code"
                      )}
                    </button>

                    <button
                      type="button"
                      className="text-xs text-primary hover:underline"
                      onClick={handleChangeEmail}
                    >
                      Wrong email? Change Email
                    </button>
                  </div>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* ILLUSTRATION - RIGHT SIDE */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
          <div className="max-w-md p-8">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img src="/i.png" alt="Language connection illustration" className="w-full h-full" />
            </div>

            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">Connect with language partners worldwide</h2>
              <p className="opacity-70">
                Practice conversations, make friends, and improve your language skills together
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SignupPage;
