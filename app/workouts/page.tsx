"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import {
  Activity,
  ArrowLeft,
  Gift,
  HeartPulse,
  Loader2,
  MapPin,
  RefreshCw,
  Timer,
  Trophy,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";
import { syncLeaderboard } from "@/lib/leaderboard";

type Workout = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  distanceKm: number;
  averageHeartRate: number;
  maxHeartRate: number;
  heartRatePercentage: number;
  heartRateZone: string;
  basePoints: number;
  bonusPoints: number;
  points: number;
  source: string;
};

export default function WorkoutsPage() {
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [workouts, setWorkouts] = useState<Workout[]>([]);

  async function loadWorkouts(userId: string) {
    const workoutsReference = collection(
      db,
      "users",
      userId,
      "workouts"
    );

    const workoutsQuery = query(
      workoutsReference,
      orderBy("date", "desc")
    );

    const snapshot = await getDocs(workoutsQuery);

    const results: Workout[] = snapshot.docs.map((workoutDocument) => {
      const data = workoutDocument.data();

      return {
        id: workoutDocument.id,
        date: data.date ?? "",
        type: data.type ?? "Other",
        durationMinutes: Number(data.durationMinutes ?? 0),
        distanceKm: Number(data.distanceKm ?? 0),
        averageHeartRate: Number(data.averageHeartRate ?? 0),
        maxHeartRate: Number(data.maxHeartRate ?? 0),
        heartRatePercentage: Number(data.heartRatePercentage ?? 0),
        heartRateZone: data.heartRateZone ?? "",
        basePoints: Number(data.basePoints ?? data.points ?? 0),
        bonusPoints: Number(data.bonusPoints ?? 0),
        points: Number(data.points ?? 0),
        source: data.source ?? "google_fit",
      };
    });

    setWorkouts(results);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        await loadWorkouts(user.uid);
        await syncLeaderboard(user.uid);
      } catch (error) {
        console.error("Workout loading error:", error);
        setError("We could not load your workout data.");
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  async function refreshWorkouts() {
    const user = auth.currentUser;
    if (!user) return;

    setRefreshing(true);
    setError("");

    try {
      const idToken = await user.getIdToken(true);

      const response = await fetch("/api/google-fit/sync", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${idToken}`,
          "Content-Type": "application/json",
        },
        cache: "no-store",
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || "Google Fit sync failed.");
      }

      await loadWorkouts(user.uid);
      await syncLeaderboard(user.uid);
    } catch (error) {
      console.error("Workout refresh error:", error);
      setError(
        error instanceof Error
          ? error.message
          : "We could not refresh your workouts."
      );
    } finally {
      setRefreshing(false);
    }
  }

  const totalPoints = workouts.reduce(
    (total, workout) => total + workout.points,
    0
  );

  const totalBonusPoints = workouts.reduce(
    (total, workout) => total + workout.bonusPoints,
    0
  );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">
        <Loader2 className="mr-3 animate-spin" size={22} />
        Loading workouts...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">
      <div className="mx-auto max-w-6xl">

        <div className="mb-8 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={17} />
            Dashboard
          </button>

          <button
            type="button"
            onClick={refreshWorkouts}
            disabled={refreshing}
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <RefreshCw
              size={16}
              className={refreshing ? "animate-spin" : ""}
            />
            {refreshing ? "Syncing..." : "Refresh"}
          </button>
        </div>

        <header className="mb-10">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Activity
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Workouts
          </h1>

          <p className="mt-3 max-w-2xl text-slate-500">
            Workouts are imported automatically from Google Fit and scored using your Hybrid Human performance rules.
          </p>
        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">
          <div className="flex items-start gap-4">
            <Activity className="mt-1 shrink-0 text-emerald-400" size={22} />

            <div>
              <h2 className="font-semibold text-emerald-300">
                Automatic workout import
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Manual workout entry is disabled. Google Fit workouts are imported automatically when you sign in or refresh the dashboard.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={<Activity size={20} />}
            label="Workouts"
            value={`${workouts.length}`}
          />

          <SummaryCard
            icon={<Trophy size={20} />}
            label="Total Points"
            value={`${totalPoints}`}
          />

          <SummaryCard
            icon={<Gift size={20} />}
            label="Bonus Points"
            value={`${totalBonusPoints}`}
          />
        </div>

        <section className="mt-8 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">
          <div className="border-b border-white/10 p-6">
            <p className="text-sm text-slate-500">
              Activity history
            </p>

            <h2 className="mt-1 text-xl font-semibold">
              Recent workouts
            </h2>
          </div>

          {workouts.length === 0 ? (
            <div className="flex min-h-80 items-center justify-center p-8">
              <div className="max-w-md text-center">
                <Activity
                  className="mx-auto text-slate-700"
                  size={40}
                />

                <p className="mt-4 font-medium">
                  No synced workouts yet
                </p>

                <p className="mt-2 text-sm leading-6 text-slate-500">
                  Connect Google Fit and record a workout on your connected health platform. Hybrid Human will import and score it automatically.
                </p>

                <button
                  type="button"
                  onClick={() => router.push("/devices")}
                  className="mt-5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-2.5 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  Connected Devices
                </button>
              </div>
            </div>
          ) : (
            <div className="divide-y divide-white/10">
              {workouts.map((workout) => (
                <div key={workout.id} className="p-5">
                  <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                    <div>
                      <p className="font-semibold">
                        {workout.type}
                      </p>

                      <p className="mt-1 text-sm text-slate-500">
                        {workout.date}
                      </p>

                      <p className="mt-1 text-xs text-slate-600">
                        Source:{" "}
                        {workout.source === "google_fit"
                          ? "Google Fit"
                          : workout.source}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-3 text-sm">
                      <WorkoutStat
                        icon={<Timer size={16} />}
                        value={`${workout.durationMinutes} min`}
                      />

                      {workout.distanceKm > 0 && (
                        <WorkoutStat
                          icon={<MapPin size={16} />}
                          value={`${workout.distanceKm.toFixed(2)} km`}
                        />
                      )}

                      {workout.averageHeartRate > 0 && (
                        <WorkoutStat
                          icon={<HeartPulse size={16} />}
                          value={`${Math.round(
                            workout.averageHeartRate
                          )} bpm`}
                        />
                      )}

                      {workout.heartRatePercentage > 0 && (
                        <WorkoutStat
                          icon={<Activity size={16} />}
                          value={`${workout.heartRatePercentage}%`}
                        />
                      )}

                      <div className="rounded-xl bg-white/5 px-3 py-2 text-slate-400">
                        Base {workout.basePoints}
                      </div>

                      {workout.bonusPoints > 0 && (
                        <div className="rounded-xl bg-amber-500/10 px-3 py-2 font-semibold text-amber-400">
                          +{workout.bonusPoints} Bonus
                        </div>
                      )}

                      <div className="rounded-xl bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-400">
                        {workout.points} pts
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">
      <div className="text-emerald-400">
        {icon}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {label}
      </p>

      <p className="mt-2 text-3xl font-bold">
        {value}
      </p>
    </div>
  );
}

function WorkoutStat({
  icon,
  value,
}: {
  icon: React.ReactNode;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-xl bg-black/10 px-3 py-2 text-slate-400">
      {icon}
      <span>{value}</span>
    </div>
  );
}