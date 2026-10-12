
import { useState } from 'react';
import { ShipWheelIcon } from 'lucide-react';
import { Link } from 'react-router';
import useLogin from '../hooks/useLogin';

const LoginPage = () => {
  const [loginData, setLoginData] = useState({
    email: "",
    password: "",
  });

  const { isPending, loginMutation } = useLogin();

  const handleLogin = (e) => {
    e.preventDefault();
    loginMutation(loginData);
  };

  return (
    <div
      className="h-screen flex items-center justify-center p-4 sm:p-6 md:p-8"
      data-theme="forest"
    >
      <div className="border border-primary/25 flex flex-col lg:flex-row w-full max-w-5xl mx-auto bg-base-100 rounded-xl shadow-lg overflow-hidden">
        {/* LOGIN FORM SECTION */}
        <div className="w-full lg:w-1/2 p-4 sm:p-8 flex flex-col">
          {/* LOGO */}
          <div className="mb-4 flex items-center justify-start gap-2">
            <ShipWheelIcon className="size-9 text-primary" />
            <span className="text-3xl font-bold font-mono bg-clip-text text-transparent bg-gradient-to-r from-primary to-secondary tracking-wider">
              Speako
            </span>
          </div>

          <div className="w-full">
            <form onSubmit={handleLogin}>
              <div className="space-y-4">
                <div>
                  <h2 className="text-xl font-semibold">Welcome Back</h2>
                  <p className="text-sm opacity-70">
                    Sign in to your account to continue your language journey
                  </p>
                </div>

                <div className="flex flex-col gap-3">
                  <div className="form-control w-full space-y-2">
                    <label className="label">
                      <span className="label-text">Email</span>
                    </label>
                    <input
                      type="email"
                      placeholder="Enter Your Email"
                      className="input input-bordered w-full"
                      value={loginData.email}
                      onChange={(e) =>
                        setLoginData({ ...loginData, email: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="form-control w-full space-y-2">
                    <div className="flex items-center justify-between">
                      <label className="label p-0">
                        <span className="label-text">Password</span>
                      </label>
                      <Link
                        to="/forgot-password"
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        Forgot Password?
                      </Link>
                    </div>
                    <input
                      type="password"
                      placeholder="Enter Your Password"
                      className="input input-bordered w-full"
                      value={loginData.password}
                      onChange={(e) =>
                        setLoginData({ ...loginData, password: e.target.value })
                      }
                      required
                    />
                  </div>

                  <button
                    type="submit"
                    className="btn btn-primary w-full"
                    disabled={isPending}
                  >
                    {isPending ? (
                      <>
                        <span className="loading loading-spinner loading-xs"></span>
                        Signing in...
                      </>
                    ) : (
                      "Sign In"
                    )}
                  </button>

                  {/* DEMO LOGIN SECTION */}
                  <div className="text-center mt-4 space-y-2">
                    <p className="text-sm">
                      Don't have an account?{" "}
                      <Link to="/signup" className="text-primary hover:underline">
                        Create one
                      </Link>
                    </p>

                    <div className="flex flex-col gap-2 items-center">
                      <p className="text-xs opacity-70">Or try a demo account:</p>
                      <div className="flex flex-col sm:flex-row gap-2 justify-center">
                          <button
                          type="button"
                          className="btn btn-sm btn-primary"
                          onClick={() => {
                            setLoginData({ email: "karan@gmail.com", password: "123456" });
                            setTimeout(() => loginMutation({ email: "karan@gmail.com", password: "123456" }), 300);
                          }}
                        >
                          Demo: Karan
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm btn-primary "
                          onClick={() => {
                            setLoginData({ email: "arjun@gmail.com", password: "123456" });
                            setTimeout(() => loginMutation({ email: "arjun@gmail.com", password: "123456" }), 300);
                          }}
                        >
                          Demo: Arjun
                        </button>
                      
                      </div>
                    </div>
                  </div>
                  {/* END DEMO LOGIN */}
                </div>
              </div>
            </form>
          </div>
        </div>

        {/* IMAGE SECTION */}
        <div className="hidden lg:flex w-full lg:w-1/2 bg-primary/10 items-center justify-center">
          <div className="max-w-md p-8">
            <div className="relative aspect-square max-w-sm mx-auto">
              <img
                src="/i.png"
                alt="Language connection illustration"
                className="w-full h-full"
              />
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

export default LoginPage;
