"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
} from "firebase/auth";

import {
  Activity,
  Apple,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
  Trophy,
} from "lucide-react";

import { auth, googleProvider } from "@/lib/firebase";

export default function LoginPage() {
  const router = useRouter();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);

  const [error, setError] = useState("");

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setLoading(true);

    try {
      await signInWithEmailAndPassword(
        auth,
        email.trim(),
        password
      );

      router.push("/dashboard");
    } catch (error) {
      console.error(error);

      setError(
        "Unable to sign in. Check your email and password."
      );
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleLogin() {
    setError("");
    setGoogleLoading(true);

    try {
      await signInWithPopup(auth, googleProvider);

      router.push("/dashboard");
    } catch (error) {
      console.error(error);

      setError("Google sign-in was unsuccessful.");
    } finally {
      setGoogleLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07110d] text-white">
      <div className="grid min-h-screen lg:grid-cols-2">

        {/* LEFT SIDE */}
        <section className="hidden flex-col justify-between border-r border-white/10 bg-gradient-to-br from-[#0b1f17] via-[#07110d] to-black p-12 lg:flex">

          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black">
                <HeartPulse size={27} />
              </div>

              <div>
                <h1 className="text-2xl font-bold">
                  Hybrid Human
                </h1>

                <p className="text-sm text-slate-400">
                  Human performance platform
                </p>
              </div>
            </div>
          </div>

          <div className="max-w-xl">
            <p className="mb-5 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Train • Recover • Compete
            </p>

            <h2 className="text-5xl font-bold leading-tight">
              Turn your health data into
              <span className="text-emerald-400">
                {" "}
                meaningful performance.
              </span>
            </h2>

            <p className="mt-6 max-w-lg text-lg leading-8 text-slate-400">
              Track activity, recovery, sleep, wellness and
              performance while competing with friends,
              teams and colleagues.
            </p>

            <div className="mt-10 grid grid-cols-3 gap-4">

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <Activity
                  className="mb-4 text-emerald-400"
                  size={25}
                />

                <p className="font-semibold">
                  Activity
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Workouts & steps
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <HeartPulse
                  className="mb-4 text-emerald-400"
                  size={25}
                />

                <p className="font-semibold">
                  Recovery
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Sleep & wellness
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-5">
                <Trophy
                  className="mb-4 text-emerald-400"
                  size={25}
                />

                <p className="font-semibold">
                  Compete
                </p>

                <p className="mt-1 text-xs text-slate-500">
                  Points & rankings
                </p>
              </div>

            </div>
          </div>

          <p className="text-sm text-slate-600">
            © 2026 Hybrid Human
          </p>

        </section>

        {/* RIGHT SIDE */}
        <section className="flex items-center justify-center px-6 py-12">

          <div className="w-full max-w-md">

            <div className="mb-10 lg:hidden">
              <div className="flex items-center gap-3">

                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-black">
                  <HeartPulse size={24} />
                </div>

                <div>
                  <h1 className="text-xl font-bold">
                    Hybrid Human
                  </h1>

                  <p className="text-xs text-slate-500">
                    Train. Recover. Compete.
                  </p>
                </div>

              </div>
            </div>

            <div>
              <h2 className="text-3xl font-bold">
                Welcome back
              </h2>

              <p className="mt-2 text-slate-400">
                Sign in to continue to Hybrid Human.
              </p>
            </div>

            {error && (
              <div className="mt-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
                {error}
              </div>
            )}

            <form
              onSubmit={handleLogin}
              className="mt-8 space-y-5"
            >

              <div>
                <label
                  htmlFor="email"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Email address
                </label>

                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">

                  <label
                    htmlFor="password"
                    className="text-sm font-medium text-slate-300"
                  >
                    Password
                  </label>

                  <button
                    type="button"
                    className="text-xs text-emerald-400 hover:text-emerald-300"
                  >
                    Forgot password?
                  </button>

                </div>

                <div className="relative">

                  <input
                    id="password"
                    type={
                      showPassword
                        ? "text"
                        : "password"
                    }
                    required
                    value={password}
                    onChange={(event) =>
                      setPassword(event.target.value)
                    }
                    placeholder="Enter your password"
                    className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] px-4 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                  />

                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(
                        (current) => !current
                      )
                    }
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                  >
                    {showPassword ? (
                      <EyeOff size={19} />
                    ) : (
                      <Eye size={19} />
                    )}
                  </button>

                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2
                      size={19}
                      className="mr-2 animate-spin"
                    />

                    Signing in...
                  </>
                ) : (
                  "Sign In"
                )}
              </button>

            </form>

            <div className="my-7 flex items-center gap-4">

              <div className="h-px flex-1 bg-white/10" />

              <p className="text-xs uppercase tracking-widest text-slate-600">
                Or continue with
              </p>

              <div className="h-px flex-1 bg-white/10" />

            </div>

            <div className="space-y-3">

              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={googleLoading}
                className="flex h-12 w-full items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] font-medium transition hover:bg-white/[0.07] disabled:opacity-60"
              >
                {googleLoading ? (
                  <Loader2
                    size={19}
                    className="mr-2 animate-spin"
                  />
                ) : (
                  <span className="mr-3 flex h-6 w-6 items-center justify-center rounded-full bg-white font-bold text-black">
                    G
                  </span>
                )}

                Continue with Google
              </button>

              <button
                type="button"
                disabled
                className="flex h-12 w-full cursor-not-allowed items-center justify-center rounded-xl border border-white/10 bg-white/[0.02] font-medium text-slate-500"
              >
                <Apple
                  size={20}
                  className="mr-3"
                />

                Continue with Apple
              </button>

            </div>

            {/* REGISTRATION OPTION */}
            <div className="mt-8 border-t border-white/10 pt-7 text-center">

              <p className="text-sm text-slate-400">
                Don&apos;t have an account?
              </p>

              <Link
                href="/register"
                className="mt-3 flex h-12 w-full items-center justify-center rounded-xl border border-emerald-500/40 bg-emerald-500/10 font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
              >
                Create Account
              </Link>

            </div>

          </div>

        </section>

      </div>
    </main>
  );
}