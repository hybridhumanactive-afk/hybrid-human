"use client";

import {
  useEffect,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  ArrowLeft,
  Building2,
  CalendarDays,
  HeartPulse,
  Loader2,
  MapPin,
  Pencil,
  Ruler,
  Scale,
  UserRound,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

type UserProfile = {
  firstName: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  age: number;
  sex: string;
  height: number;
  weight: number;
  country: string;
  company: string;
  department: string;
};

export default function ProfilePage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [profile, setProfile] =
    useState<UserProfile | null>(
      null
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace("/login");
            return;
          }

          try {
            const reference =
              doc(
                db,
                "users",
                user.uid
              );

            const snapshot =
              await getDoc(reference);

            if (!snapshot.exists()) {
              router.replace(
                "/profile/setup"
              );

              return;
            }

            setProfile(
              snapshot.data() as UserProfile
            );
          } catch (error) {
            console.error(
              "Profile loading error:",
              error
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => unsubscribe();
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          size={22}
          className="mr-3 animate-spin"
        />

        Loading profile...

      </main>
    );
  }

  if (!profile) {
    return null;
  }

  const initials =
    `${profile.firstName?.[0] || ""}${profile.lastName?.[0] || ""}`
      .toUpperCase();

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-5xl">

        <button
          onClick={() =>
            router.push("/dashboard")
          }
          className="mb-8 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={17} />
          Dashboard
        </button>

        <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 via-white/[0.025] to-transparent p-7 sm:p-10">

          <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-center">

            <div className="flex items-center gap-5">

              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-2xl font-bold text-black">
                {initials || (
                  <UserRound size={30} />
                )}
              </div>

              <div>

                <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                  Hybrid Human
                </p>

                <h1 className="mt-2 text-3xl font-bold">
                  {profile.firstName}{" "}
                  {profile.lastName}
                </h1>

                <p className="mt-1 text-slate-500">
                  {profile.email}
                </p>

              </div>

            </div>

            <button
              onClick={() =>
                router.push("/profile/setup")
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-400"
            >
              <Pencil size={17} />
              Edit Profile
            </button>

          </div>

        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

          <ProfileCard
            icon={
              <CalendarDays size={20} />
            }
            label="Age"
            value={`${profile.age} years`}
          />

          <ProfileCard
            icon={
              <Scale size={20} />
            }
            label="Weight"
            value={`${profile.weight} kg`}
            onClick={() =>
              router.push("/weight")
            }
          />

          <ProfileCard
            icon={
              <Ruler size={20} />
            }
            label="Height"
            value={`${profile.height} cm`}
          />

          <ProfileCard
            icon={
              <HeartPulse size={20} />
            }
            label="Sex"
            value={profile.sex}
          />

          <ProfileCard
            icon={
              <MapPin size={20} />
            }
            label="Country"
            value={
              profile.country ||
              "Not provided"
            }
          />

          <ProfileCard
            icon={
              <Building2 size={20} />
            }
            label="Company"
            value={
              profile.company ||
              "Personal account"
            }
          />

        </div>

        <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">

          <p className="text-sm text-slate-500">
            Workplace
          </p>

          <h2 className="mt-1 text-xl font-semibold">
            Corporate profile
          </h2>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">

            <div>

              <p className="text-xs uppercase tracking-wider text-slate-600">
                Company
              </p>

              <p className="mt-1 font-semibold">
                {profile.company ||
                  "Not connected"}
              </p>

            </div>

            <div>

              <p className="text-xs uppercase tracking-wider text-slate-600">
                Department / Team
              </p>

              <p className="mt-1 font-semibold">
                {profile.department ||
                  "Not connected"}
              </p>

            </div>

          </div>

        </div>

      </div>

    </main>
  );
}

function ProfileCard({
  icon,
  label,
  value,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className={`rounded-2xl border border-white/10 bg-white/[0.025] p-5 text-left ${
        onClick
          ? "transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
          : ""
      }`}
    >

      <div className="text-emerald-400">
        {icon}
      </div>

      <p className="mt-4 text-xs uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-1 text-lg font-semibold">
        {value}
      </p>

    </button>
  );
}