"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import {
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

import {
  ArrowLeft,
  Eye,
  EyeOff,
  HeartPulse,
  Loader2,
} from "lucide-react";

import { auth } from "@/lib/firebase";

export default function RegisterPage() {
  const router = useRouter();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  async function handleContinue(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    setError("");

    if (!firstName.trim()) {
      setError("Please enter your first name.");
      return;
    }

    if (!lastName.trim()) {
      setError("Please enter your last name.");
      return;
    }

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }

    if (password.length < 6) {
      setError(
        "Your password must contain at least 6 characters."
      );
      return;
    }

    setLoading(true);

    try {
      const credential =
        await createUserWithEmailAndPassword(
          auth,
          email.trim(),
          password
        );

      await updateProfile(credential.user, {
        displayName:
          `${firstName.trim()} ${lastName.trim()}`.trim(),
      });

      router.push("/profile/setup");
    } catch (error: unknown) {
      console.error("Registration error:", error);

      if (
        typeof error === "object" &&
        error !== null &&
        "code" in error
      ) {
        const firebaseError = error as {
          code?: string;
          message?: string;
        };

        switch (firebaseError.code) {
          case "auth/email-already-in-use":
            setError(
              "This email address already has an account. Please sign in instead."
            );
            break;

          case "auth/invalid-email":
            setError(
              "Please enter a valid email address."
            );
            break;

          case "auth/weak-password":
            setError(
              "Your password is too weak. Please use a stronger password."
            );
            break;

          case "auth/operation-not-allowed":
            setError(
              "Email/password registration is not enabled in Firebase."
            );
            break;

          case "auth/unauthorized-domain":
            setError(
              "This website address is not authorized in Firebase Authentication."
            );
            break;

          case "auth/network-request-failed":
            setError(
              "The connection to Firebase failed. Check your internet connection and try again."
            );
            break;

          default:
            setError(
              `Firebase error: ${
                firebaseError.code ||
                firebaseError.message ||
                "Unknown error"
              }`
            );
        }

        return;
      }

      setError(
        "We could not continue with registration. Please try again."
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07110d] px-6 py-10 text-white">
      <div className="mx-auto max-w-2xl">

        <Link
          href="/login"
          className="mb-10 inline-flex items-center text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft
            size={17}
            className="mr-2"
          />

          Back to sign in
        </Link>

        <div className="mb-10 flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black">
            <HeartPulse size={27} />
          </div>

          <div>
            <h1 className="text-2xl font-bold">
              Hybrid Human
            </h1>

            <p className="text-sm text-slate-500">
              Create your performance profile
            </p>
          </div>
        </div>

        <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-7 sm:p-10">

          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Step 1 of 2
            </p>

            <h2 className="mt-3 text-3xl font-bold">
              Create your login
            </h2>

            <p className="mt-2 text-slate-400">
              Start with your account details. Your health and
              fitness profile comes next.
            </p>
          </div>

          {error && (
            <div className="mt-7 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <form
            onSubmit={handleContinue}
            className="mt-8 space-y-5"
          >

            <div className="grid gap-5 sm:grid-cols-2">

              <div>
                <label
                  htmlFor="firstName"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  First name
                </label>

                <input
                  id="firstName"
                  type="text"
                  required
                  value={firstName}
                  onChange={(event) =>
                    setFirstName(event.target.value)
                  }
                  placeholder="First name"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                />
              </div>

              <div>
                <label
                  htmlFor="lastName"
                  className="mb-2 block text-sm font-medium text-slate-300"
                >
                  Last name
                </label>

                <input
                  id="lastName"
                  type="text"
                  required
                  value={lastName}
                  onChange={(event) =>
                    setLastName(event.target.value)
                  }
                  placeholder="Last name"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                />
              </div>

            </div>

            <div>
              <label
                htmlFor="email"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Email
              </label>

              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                placeholder="you@example.com"
                className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
              />
            </div>

            <div>
              <label
                htmlFor="password"
                className="mb-2 block text-sm font-medium text-slate-300"
              >
                Password
              </label>

              <div className="relative">

                <input
                  id="password"
                  type={
                    showPassword
                      ? "text"
                      : "password"
                  }
                  required
                  autoComplete="new-password"
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Minimum 6 characters"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 pr-12 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 transition hover:text-white"
                  aria-label={
                    showPassword
                      ? "Hide password"
                      : "Show password"
                  }
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
              className="flex h-12 w-full items-center justify-center rounded-xl bg-emerald-500 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {loading ? (
                <>
                  <Loader2
                    size={19}
                    className="mr-2 animate-spin"
                  />

                  Continuing...
                </>
              ) : (
                "Continue"
              )}
            </button>

          </form>

          <p className="mt-7 text-center text-sm text-slate-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-emerald-400"
            >
              Sign in
            </Link>
          </p>

        </div>
      </div>
    </main>
  );
}