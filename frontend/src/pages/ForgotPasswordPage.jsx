import { ShipWheelIcon, Eye, EyeOff, CheckCircle2, ArrowLeft, KeyRound, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router';
import { useMutation } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { forgotPassword, verifyResetOtp, resetPassword } from '../lib/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();

  const [step, setStep] = useState(1); // 1: Email, 2: OTP, 3: New Password, 4: Success
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [countdown, setCountdown] = useState(60);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // 60-second cooldown timer for resending OTP
  useEffect(() => {
    if (step !== 2 || countdown <= 0) return;
    const timer = setInterval(() => {
      setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [step, countdown]);

  // Step 1: Request Password Reset OTP
  const {
    mutate: requestResetMutation,
    isPending: isRequesting,
    error: requestError,
  } = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (data) => {
      toast.success(data.message || 'Verification code sent to your email.');
      setStep(2);
      setCountdown(60);
      setOtp('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to send verification code.');
    },
  });

  // Step 2: Verify OTP Mutation
  const {
    mutate: verifyOtpMutation,
    isPending: isVerifying,
    error: verifyError,
  } = useMutation({
    mutationFn: verifyResetOtp,
    onSuccess: (data) => {
      toast.success('Code verified successfully.');
      setResetToken(data.resetToken);
      setStep(3);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Invalid or expired code.');
    },
  });

  // Resend OTP Mutation
  const {
    mutate: resendMutation,
    isPending: isResending,
  } = useMutation({
    mutationFn: forgotPassword,
    onSuccess: (data) => {
      toast.success(data.message || 'A new verification code has been sent.');
      setCountdown(60);
      setOtp('');
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to resend code.');
    },
  });

  // Step 3: Reset Password Mutation
  const {
    mutate: resetPasswordMutation,
    isPending: isResetting,
    error: resetError,
  } = useMutation({
    mutationFn: resetPassword,
    onSuccess: () => {
      toast.success('Password reset successfully!');
      setResetToken('');
      setNewPassword('');
      setConfirmPassword('');
      setStep(4);
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to reset password.');
    },
  });

  const handleRequestOtp = (e) => {
    e.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.endsWith('@gmail.com')) {
      toast.error('Only @gmail.com email addresses are allowed.');
      return;
    }
    requestResetMutation({ email: normalizedEmail });
  };

  const handleVerifyOtp = (e) => {
    e.preventDefault();
    const cleanOtp = otp.trim();
    if (cleanOtp.length !== 6) {
      toast.error('Please enter a 6-digit verification code.');
      return;
    }
    verifyOtpMutation({ email: email.trim().toLowerCase(), otp: cleanOtp });
  };

  const handleResend = () => {
    if (countdown > 0 || isResending) return;
    resendMutation({ email: email.trim().toLowerCase() });
  };

  const handleChangeEmail = () => {
    setStep(1);
    setOtp('');
    setResetToken('');
  };

  const handleResetPassword = (e) => {
    e.preventDefault();
    if (newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long.');
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    resetPasswordMutation({
      resetToken,
      newPassword,
    });
  };

  return (
    <div className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8" data-theme="forest">
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-4xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* FORM SECTION - LEFT */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col justify-center">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              Speako
            </span>
          </div>

          {/* STEP 1: REQUEST CODE */}
          {step === 1 && (
            <div className="w-full">
              {requestError && (
                <div className="alert alert-error mb-4">
                  <span>{requestError.response?.data?.message || 'Something went wrong.'}</span>
                </div>
              )}

              <form onSubmit={handleRequestOtp}>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <Mail className="size-5 text-primary" /> Reset Your Password
                    </h2>
                    <p className="text-sm opacity-70 mt-1">
                      Enter your registered Gmail address. We'll send you a 6-digit verification code to recover your account.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">Registered Gmail</span>
                      </label>
                      <input
                        type="email"
                        placeholder="yourname@gmail.com"
                        className="input input-bordered w-full"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>
                  </div>

                  <button className="btn btn-primary w-full" type="submit" disabled={isRequesting}>
                    {isRequesting ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Sending Code...
                      </>
                    ) : (
                      'Send Verification Code'
                    )}
                  </button>

                  <div className="text-center mt-4">
                    <Link to="/login" className="text-sm text-primary hover:underline inline-flex items-center gap-1">
                      <ArrowLeft className="size-4" /> Back to Login
                    </Link>
                  </div>
                </div>
              </form>
            </div>
          )}

          {/* STEP 2: VERIFY CODE */}
          {step === 2 && (
            <div className="w-full">
              {verifyError && (
                <div className="alert alert-error mb-4">
                  <span>{verifyError.response?.data?.message || 'Verification failed.'}</span>
                </div>
              )}

              <form onSubmit={handleVerifyOtp}>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold">Verify Reset Code</h2>
                    <p className="text-sm opacity-70 mt-1">
                      Code sent to: <span className="font-semibold text-primary">{email}</span>
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
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
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
                        Verifying Code...
                      </>
                    ) : (
                      'Verify & Continue'
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
                        'Resend Code'
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

          {/* STEP 3: SET NEW PASSWORD */}
          {step === 3 && (
            <div className="w-full">
              {resetError && (
                <div className="alert alert-error mb-4">
                  <span>{resetError.response?.data?.message || 'Failed to update password.'}</span>
                </div>
              )}

              <form onSubmit={handleResetPassword}>
                <div className="space-y-4">
                  <div>
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                      <KeyRound className="size-5 text-primary" /> Set New Password
                    </h2>
                    <p className="text-sm opacity-70 mt-1">
                      Create a strong new password for your Speako account.
                    </p>
                  </div>

                  <div className="space-y-3">
                    {/* New Password */}
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">New Password</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showNewPassword ? 'text' : 'password'}
                          placeholder="At least 6 characters"
                          className="input input-bordered w-full pr-10"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          required
                          minLength={6}
                          autoFocus
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                          onClick={() => setShowNewPassword(!showNewPassword)}
                        >
                          {showNewPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>

                    {/* Confirm New Password */}
                    <div className="form-control w-full">
                      <label className="label">
                        <span className="label-text">Confirm New Password</span>
                      </label>
                      <div className="relative">
                        <input
                          type={showConfirmPassword ? 'text' : 'password'}
                          placeholder="Re-enter new password"
                          className="input input-bordered w-full pr-10"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          required
                          minLength={6}
                        />
                        <button
                          type="button"
                          className="absolute right-3 top-1/2 -translate-y-1/2 opacity-70 hover:opacity-100"
                          onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        >
                          {showConfirmPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    className="btn btn-primary w-full"
                    type="submit"
                    disabled={isResetting || !newPassword || !confirmPassword}
                  >
                    {isResetting ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Updating Password...
                      </>
                    ) : (
                      'Update Password'
                    )}
                  </button>
                </div>
              </form>
            </div>
          )}

          {/* STEP 4: SUCCESS CONFIRMATION */}
          {step === 4 && (
            <div className="w-full text-center py-4 space-y-4">
              <div className="size-16 bg-success/20 text-success rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="size-10" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-success">Password Updated!</h2>
                <p className="text-sm opacity-70 mt-2">
                  Your password has been securely reset. All active sessions have been revoked.
                </p>
              </div>

              <button
                type="button"
                className="btn btn-primary w-full mt-4"
                onClick={() => navigate('/login')}
              >
                Sign In Now
              </button>
            </div>
          )}
        </div>

        {/* ILLUSTRATION SECTION - RIGHT */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
          <div className="max-w-md p-8">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img src="/i.png" alt="Language connection illustration" className="w-full h-full" />
            </div>

            <div className="text-center space-y-3 mt-6">
              <h2 className="text-xl font-semibold">Safe and Secure Access</h2>
              <p className="opacity-70">
                Protecting your account while keeping your language conversations going seamlessly
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
