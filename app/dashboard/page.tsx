"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  onAuthStateChanged,
  signOut,
} from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
} from "firebase/firestore";

import {
  Activity,
  Bell,
  Dumbbell,
  Footprints,
  Heart,
  HeartPulse,
  LogOut,
  Moon,
  Route,
  Scale,
  Settings,
  SmilePlus,
  Trophy,
  UserRound,
  Watch,
  Zap,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getCurrentWeekKey,
  syncLeaderboard,
  type LeaderboardSyncResult,
} from "@/lib/leaderboard";


type UserProfile = {
  uid: string;
  email: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  age: number;
  sex: string;
  height: number;
  weight: number;
  country: string;
  company: string;
  department: string;
  profileCompleted: boolean;
};

type Workout = {
  id: string;
  date: string;
  type: string;
  durationMinutes: number;
  averageHeartRate: number;
  heartRatePercentage: number;
  points: number;
  source: string;
};

type GoogleFitDailyData = {
  steps: number | null;
  distanceMeters: number | null;
  distanceKm: number | null;
  heartRateAverage: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
  date: string | null;
  provider: string | null;
};

function getTodayKey() {
  return new Date()
    .toISOString()
    .slice(
      0,
      10
    );
}

function getStartOfWeekKey() {
  const now =
    new Date();

  const day =
    now.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  const monday =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() +
        difference
    );

  const year =
    monday.getFullYear();

  const month =
    String(
      monday.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const date =
    String(
      monday.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${date}`;
}

function getStartOfMonthKey() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-01`;
}

export default function DashboardPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    profile,
    setProfile,
  ] =
    useState<UserProfile | null>(
      null
    );

  const [
    workouts,
    setWorkouts,
  ] =
    useState<Workout[]>(
      []
    );

  const [
    googleFit,
    setGoogleFit,
  ] =
    useState<GoogleFitDailyData>({
      steps:
        null,

      distanceMeters:
        null,

      distanceKm:
        null,

      heartRateAverage:
        null,

      heartRateMin:
        null,

      heartRateMax:
        null,

      date:
        null,

      provider:
        null,
    });

  const [
    googleFitConnected,
    setGoogleFitConnected,
  ] =
    useState(
      false
    );

  const [
    leaderboardSummary,
    setLeaderboardSummary,
  ] =
    useState<LeaderboardSyncResult | null>(
      null
    );

  const [
    weeklyRank,
    setWeeklyRank,
  ] =
    useState<number | null>(
      null
    );

  useEffect(() => {
    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (user) => {
          if (!user) {
            router.replace(
              "/login"
            );

            return;
          }

          try {
            const profileReference =
              doc(
                db,
                "users",
                user.uid
              );

            const profileSnapshot =
              await getDoc(
                profileReference
              );

            if (
              !profileSnapshot.exists()
            ) {
              router.replace(
                "/profile/setup"
              );

              return;
            }

            const profileData =
              profileSnapshot.data() as UserProfile;

            if (
              !profileData.profileCompleted
            ) {
              router.replace(
                "/profile/setup"
              );

              return;
            }

            setProfile(
              profileData
            );

            const workoutReference =
              collection(
                db,
                "users",
                user.uid,
                "workouts"
              );

            const workoutSnapshot =
              await getDocs(
                workoutReference
              );

            const workoutData =
              workoutSnapshot.docs.map(
                (
                  document
                ) => {
                  const data =
                    document.data();

                  return {
                    id:
                      document.id,

                    date:
                      data.date,

                    type:
                      data.type,

                    durationMinutes:
                      Number(
                        data.durationMinutes
                      ),

                    averageHeartRate:
                      Number(
                        data.averageHeartRate
                      ),

                    heartRatePercentage:
                      Number(
                        data.heartRatePercentage
                      ),

                    points:
                      Number(
                        data.points
                      ),

                    source:
                      data.source ||
                      "manual",
                  };
                }
              );

            workoutData.sort(
              (
                a,
                b
              ) =>
                b.date.localeCompare(
                  a.date
                )
            );

            setWorkouts(
              workoutData
            );

            await syncGoogleFit();

            await loadGoogleFitData(
              user.uid
            );
          } catch (error) {
            console.error(
              "Dashboard loading error:",
              error
            );
          } finally {
            setLoading(
              false
            );
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  async function syncGoogleFit() {
    const user =
      auth.currentUser;

    if (!user) {
      return false;
    }

    try {
      const idToken =
        await user.getIdToken(
          true
        );

      const response =
        await fetch(
          "/api/google-fit/sync",
          {
            method: "POST",

            headers: {
              Authorization:
                `Bearer ${idToken}`,

              "Content-Type":
                "application/json",
            },

            cache:
              "no-store",
          }
        );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        error?: string;
      } = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          console.error(
            "Google Fit automatic sync returned invalid JSON."
          );

          return false;
        }
      }

      if (
        !response.ok ||
        !data.success
      ) {
        console.log(
          "Google Fit automatic sync skipped:",
          data.error ||
            `HTTP ${response.status}`
        );

        return false;
      }

      console.log(
        "Google Fit automatically synced."
      );

      const leaderboard =
        await syncLeaderboard(
          user.uid
        );

      setLeaderboardSummary(
        leaderboard
      );

      await loadWeeklyRank(
        user.uid
      );

      return true;
    } catch (error) {
      console.error(
        "Google Fit automatic sync failed:",
        error
      );

      return false;
    }
  }

  async function loadWeeklyRank(
    uid: string
  ) {
    try {
      const leaderboardReference =
        collection(
          db,
          "leaderboardEntries"
        );

      const snapshot =
        await getDocs(
          leaderboardReference
        );

      const currentWeekKey =
        getCurrentWeekKey();

      const currentEntries =
        snapshot.docs
          .map(
            (leaderboardDocument) => {
              const data =
                leaderboardDocument.data();

              return {
                uid:
                  data.uid ||
                  leaderboardDocument.id,

                weeklyPoints:
                  Number(
                    data.weeklyPoints ||
                      0
                  ),

                weekKey:
                  data.weekKey ||
                  "",
              };
            }
          )
          .filter(
            (entry) =>
              entry.weekKey ===
              currentWeekKey
          )
          .sort(
            (a, b) =>
              b.weeklyPoints -
              a.weeklyPoints
          );

      const index =
        currentEntries.findIndex(
          (entry) =>
            entry.uid === uid
        );

      setWeeklyRank(
        index >= 0
          ? index + 1
          : null
      );
    } catch (error) {
      console.error(
        "Weekly rank loading error:",
        error
      );

      setWeeklyRank(
        null
      );
    }
  }

  async function loadGoogleFitData(
    uid: string
  ) {
    try {
      const connectionReference =
        doc(
          db,
          "users",
          uid,
          "deviceConnections",
          "google_fit"
        );

      const connectionSnapshot =
        await getDoc(
          connectionReference
        );

      const connected =
        connectionSnapshot.exists() &&
        connectionSnapshot.data()
          .status ===
          "connected";

      setGoogleFitConnected(
        connected
      );

      const dateId =
        getTodayKey();

      const googleFitReference =
        doc(
          db,
          "users",
          uid,
          "googleFitDaily",
          dateId
        );

      const googleFitSnapshot =
        await getDoc(
          googleFitReference
        );

      if (
        !googleFitSnapshot.exists()
      ) {
        return;
      }

      const data =
        googleFitSnapshot.data();

      setGoogleFit({
        steps:
          typeof data.steps ===
          "number"
            ? data.steps
            : null,

        distanceMeters:
          typeof data.distanceMeters ===
          "number"
            ? data.distanceMeters
            : null,

        distanceKm:
          typeof data.distanceKm ===
          "number"
            ? data.distanceKm
            : null,

        heartRateAverage:
          typeof data.heartRateAverage ===
          "number"
            ? data.heartRateAverage
            : null,

        heartRateMin:
          typeof data.heartRateMin ===
          "number"
            ? data.heartRateMin
            : null,

        heartRateMax:
          typeof data.heartRateMax ===
          "number"
            ? data.heartRateMax
            : null,

        date:
          typeof data.date ===
          "string"
            ? data.date
            : dateId,

        provider:
          typeof data.provider ===
          "string"
            ? data.provider
            : "google_fit",
      });
    } catch (error) {
      console.error(
        "Google Fit dashboard loading error:",
        error
      );
    }
  }

  async function handleLogout() {
    await signOut(
      auth
    );

    router.replace(
      "/login"
    );
  }

  const weeklyPoints =
    leaderboardSummary?.weeklyPoints ??
    0;

  const monthlyPoints =
    leaderboardSummary?.monthlyPoints ??
    0;

  const weeklyWorkoutCount =
    useMemo(() => {
      const weekStart =
        getStartOfWeekKey();

      return workouts.filter(
        (
          workout
        ) =>
          workout.date >=
          weekStart
      ).length;
    }, [workouts]);

  const latestWorkout =
    workouts.length > 0
      ? workouts[0]
      : null;

  const stepValue =
    googleFit.steps !==
    null
      ? googleFit.steps.toLocaleString()
      : "0";

  const distanceValue =
    googleFit.distanceKm !==
    null
      ? googleFit.distanceKm.toFixed(
          2
        )
      : "--";

  const averageHeartRateValue =
    googleFit.heartRateAverage !==
    null
      ? String(
          Math.round(
            googleFit.heartRateAverage
          )
        )
      : "--";

  const heartRateRange =
    googleFit.heartRateMin !==
      null &&
    googleFit.heartRateMax !==
      null
      ? `${Math.round(
          googleFit.heartRateMin
        )}-${Math.round(
          googleFit.heartRateMax
        )} bpm`
      : "No HR data today";

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">
        Loading Hybrid Human...
      </main>
    );
  }

  const name =
    profile?.firstName ||
    auth.currentUser
      ?.displayName
      ?.split(
        " "
      )[0] ||
    "Athlete";

  return (
    <main className="min-h-screen bg-[#06100c] text-white">
      <div className="flex min-h-screen">

        <aside className="hidden w-72 flex-col border-r border-white/10 bg-[#08140f] p-6 lg:flex">

          <div className="flex items-center gap-3">

            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-500 text-black">

              <HeartPulse
                size={24}
              />

            </div>

            <div>

              <h1 className="font-bold">
                Hybrid Human
              </h1>

              <p className="text-xs text-slate-500">
                Human Performance
              </p>

            </div>

          </div>

          <nav className="mt-10 space-y-2">

            <SidebarButton
              active
              icon={
                <Activity
                  size={19}
                />
              }
              label="Dashboard"
              onClick={() =>
                router.push(
                  "/dashboard"
                )
              }
            />

            <SidebarButton
              icon={
                <Dumbbell
                  size={19}
                />
              }
              label="Workouts"
              onClick={() =>
                router.push(
                  "/workouts"
                )
              }
            />

            <SidebarButton
              icon={
                <SmilePlus
                  size={19}
                />
              }
              label="Wellness"
              onClick={() =>
                router.push(
                  "/wellness"
                )
              }
            />

            <SidebarButton
              icon={
                <Scale
                  size={19}
                />
              }
              label="Weight"
              onClick={() =>
                router.push(
                  "/weight"
                )
              }
            />

            <SidebarButton
              icon={
                <Trophy
                  size={19}
                />
              }
              label="Leaderboard"
              onClick={() =>
                router.push(
                  "/leaderboard"
                )
              }
            />

            <SidebarButton
              icon={
                <Watch
                  size={19}
                />
              }
              label="Devices"
              onClick={() =>
                router.push(
                  "/devices"
                )
              }
            />

            <SidebarButton
              icon={
                <UserRound
                  size={19}
                />
              }
              label="Profile"
              onClick={() =>
                router.push(
                  "/profile"
                )
              }
            />

            <SidebarButton
              icon={
                <Settings
                  size={19}
                />
              }
              label="Settings"
              onClick={() =>
                router.push(
                  "/profile"
                )
              }
            />

          </nav>

          <div className="mt-auto">

            <button
              type="button"
              onClick={
                handleLogout
              }
              className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left text-slate-500 transition hover:bg-red-500/10 hover:text-red-400"
            >

              <LogOut
                size={19}
              />

              Sign out

            </button>

          </div>

        </aside>

        <section className="min-w-0 flex-1">

          <header className="flex h-20 items-center justify-between border-b border-white/10 px-6 lg:px-10">

            <div>

              <p className="text-sm text-slate-500">
                Welcome back
              </p>

              <h2 className="text-lg font-semibold">
                {name}
              </h2>

            </div>

            <div className="flex items-center gap-3">

              <button
                type="button"
                className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-400 transition hover:text-white"
              >

                <Bell
                  size={19}
                />

              </button>

              <button
                type="button"
                onClick={() =>
                  router.push(
                    "/profile"
                  )
                }
                className="flex h-10 w-10 items-center justify-center rounded-full bg-emerald-500 font-semibold text-black"
              >

                {name
                  .charAt(
                    0
                  )
                  .toUpperCase()}

              </button>

            </div>

          </header>

          <div className="p-6 lg:p-10">

            <div className="mb-8">

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Today
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Your performance
              </h1>

              <p className="mt-2 text-slate-500">
                Your health, activity and wellness data in one place.
              </p>

            </div>

            {googleFitConnected && (
              <div className="mb-6 flex flex-col gap-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 sm:flex-row sm:items-center sm:justify-between">

                <div>

                  <div className="flex items-center gap-2">

                    <HeartPulse
                      size={18}
                      className="text-emerald-400"
                    />

                    <p className="font-semibold text-emerald-300">
                      Google Fit connected
                    </p>

                  </div>

                  <p className="mt-2 text-sm text-slate-500">
                    Today&apos;s synced activity data is available on your dashboard.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/integrations/google-fit"
                    )
                  }
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  Manage Google Fit
                </button>

              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">

              <MetricCard
                title="Recovery"
                value="--"
                unit="%"
                subtitle="Waiting for recovery data"
                icon={
                  <Zap
                    size={22}
                  />
                }
              />

              <MetricCard
                title="Steps"
                value={
                  stepValue
                }
                unit=""
                subtitle={
                  googleFit.steps !==
                  null
                    ? "Google Fit · Today"
                    : "No synced steps today"
                }
                icon={
                  <Footprints
                    size={22}
                  />
                }
              />

              <MetricCard
                title="Distance"
                value={
                  distanceValue
                }
                unit={
                  googleFit.distanceKm !==
                  null
                    ? "km"
                    : ""
                }
                subtitle={
                  googleFit.distanceKm !==
                  null
                    ? "Google Fit · Today"
                    : "No distance data today"
                }
                icon={
                  <Route
                    size={22}
                  />
                }
              />

              <MetricCard
                title="Sleep"
                value="--"
                unit="hrs"
                subtitle="Last night"
                icon={
                  <Moon
                    size={22}
                  />
                }
              />

              <MetricCard
                title="Average HR"
                value={
                  averageHeartRateValue
                }
                unit={
                  googleFit.heartRateAverage !==
                  null
                    ? "bpm"
                    : ""
                }
                subtitle={
                  heartRateRange
                }
                icon={
                  <Heart
                    size={22}
                  />
                }
              />

            </div>

            <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">

              <QuickAction
                title="Add Workout"
                subtitle={`${weeklyWorkoutCount} this week`}
                icon={
                  <Dumbbell
                    size={20}
                  />
                }
                onClick={() =>
                  router.push(
                    "/workouts"
                  )
                }
              />

              <QuickAction
                title="Daily Check-In"
                subtitle="Mood, energy & stress"
                icon={
                  <SmilePlus
                    size={20}
                  />
                }
                onClick={() =>
                  router.push(
                    "/wellness"
                  )
                }
              />

              <QuickAction
                title="Update Weight"
                subtitle={
                  profile
                    ? `${profile.weight} kg currently`
                    : "Track progress"
                }
                icon={
                  <Scale
                    size={20}
                  />
                }
                onClick={() =>
                  router.push(
                    "/weight"
                  )
                }
              />

              <QuickAction
                title="Connected Devices"
                subtitle={
                  googleFitConnected
                    ? "Google Fit connected"
                    : "Connect a health platform"
                }
                icon={
                  <Watch
                    size={20}
                  />
                }
                onClick={() =>
                  router.push(
                    "/devices"
                  )
                }
              />

            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.5fr_1fr]">

              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm text-slate-500">
                      Activity
                    </p>

                    <h3 className="mt-1 text-xl font-semibold">
                      Recent performance
                    </h3>

                  </div>

                  <Activity className="text-emerald-400" />

                </div>

                {latestWorkout ? (
                  <div className="mt-8 rounded-2xl border border-white/10 bg-black/10 p-6">

                    <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-center">

                      <div>

                        <p className="text-sm text-slate-500">
                          Latest workout
                        </p>

                        <h4 className="mt-1 text-2xl font-semibold">
                          {latestWorkout.type}
                        </h4>

                        <p className="mt-2 text-sm text-slate-500">
                          {latestWorkout.date}
                        </p>

                      </div>

                      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">

                        <MiniMetric
                          label="Duration"
                          value={`${latestWorkout.durationMinutes} min`}
                        />

                        <MiniMetric
                          label="Avg HR"
                          value={`${latestWorkout.averageHeartRate} bpm`}
                        />

                        <MiniMetric
                          label="Intensity"
                          value={`${latestWorkout.heartRatePercentage}%`}
                        />

                        <MiniMetric
                          label="Points"
                          value={`${latestWorkout.points}`}
                          highlight
                        />

                      </div>

                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        router.push(
                          "/workouts"
                        )
                      }
                      className="mt-6 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                    >
                      View All Workouts
                    </button>

                  </div>
                ) : (
                  <div className="mt-8 flex h-64 items-center justify-center rounded-2xl border border-dashed border-white/10 bg-black/10">

                    <div className="text-center">

                      <Dumbbell
                        size={36}
                        className="mx-auto text-slate-600"
                      />

                      <p className="mt-4 font-medium">
                        No workouts yet
                      </p>

                      <p className="mt-2 max-w-sm text-sm text-slate-500">
                        Add a manual workout or connect a supported device.
                      </p>

                      <button
                        type="button"
                        onClick={() =>
                          router.push(
                            "/workouts"
                          )
                        }
                        className="mt-5 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-black transition hover:bg-emerald-400"
                      >
                        Add Workout
                      </button>

                    </div>

                  </div>
                )}

              </div>

              <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-emerald-500/10 to-transparent p-6">

                <div className="flex items-center justify-between">

                  <div>

                    <p className="text-sm text-slate-500">
                      Hybrid Points
                    </p>

                    <h3 className="mt-1 text-xl font-semibold">
                      Weekly score
                    </h3>

                  </div>

                  <Trophy className="text-emerald-400" />

                </div>

                <div className="mt-10">

                  <p className="text-6xl font-bold">
                    {weeklyPoints}
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    points this week
                  </p>

                </div>

                <div className="mt-8 border-t border-white/10 pt-6">

                  <div className="flex justify-between text-sm">

                    <span className="text-slate-500">
                      Weekly workouts
                    </span>

                    <span>
                      {weeklyWorkoutCount}
                    </span>

                  </div>

                  <div className="mt-4 flex justify-between text-sm">

                    <span className="text-slate-500">
                      Monthly points
                    </span>

                    <span>
                      {monthlyPoints}
                    </span>

                  </div>

                  <div className="mt-4 flex justify-between text-sm">

                    <span className="text-slate-500">
                      Weekly rank
                    </span>

                    <span>
                      {weeklyRank !== null
                        ? `#${weeklyRank}`
                        : "Not ranked"}
                    </span>

                  </div>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/leaderboard"
                    )
                  }
                  className="mt-7 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  View Leaderboard
                </button>

              </div>

            </div>

            <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">

              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">

                <div>

                  <p className="text-sm text-emerald-400">
                    Daily wellness
                  </p>

                  <h3 className="mt-1 text-xl font-semibold">
                    How are you feeling today?
                  </h3>

                  <p className="mt-2 text-sm text-slate-500">
                    Record energy, stress, sleep quality, soreness and lifestyle factors.
                  </p>

                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/wellness"
                    )
                  }
                  className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  Complete Check-In
                </button>

              </div>

            </div>

            {profile && (
              <div className="mt-6 rounded-3xl border border-white/10 bg-white/[0.025] p-6">

                <div className="flex items-center justify-between">

                  <p className="text-sm text-slate-500">
                    Your profile
                  </p>

                  <button
                    type="button"
                    onClick={() =>
                      router.push(
                        "/profile"
                      )
                    }
                    className="text-sm font-semibold text-emerald-400"
                  >
                    View profile
                  </button>

                </div>

                <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">

                  <ProfileItem
                    label="Age"
                    value={`${profile.age}`}
                  />

                  <ProfileItem
                    label="Weight"
                    value={`${profile.weight} kg`}
                  />

                  <ProfileItem
                    label="Height"
                    value={`${profile.height} cm`}
                  />

                  <ProfileItem
                    label="Company"
                    value={
                      profile.company ||
                      "Personal"
                    }
                  />

                </div>

              </div>
            )}

          </div>

        </section>

      </div>

    </main>
  );
}

function SidebarButton({
  icon,
  label,
  active = false,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className={`flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition ${
        active
          ? "bg-emerald-500/10 text-emerald-400"
          : "text-slate-400 hover:bg-white/5 hover:text-white"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

function MetricCard({
  title,
  value,
  unit,
  subtitle,
  icon,
}: {
  title: string;
  value: string;
  unit: string;
  subtitle: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5">

      <div className="flex items-center justify-between">

        <p className="text-sm text-slate-500">
          {title}
        </p>

        <div className="text-emerald-400">
          {icon}
        </div>

      </div>

      <div className="mt-5 flex items-end gap-2">

        <p className="text-3xl font-bold">
          {value}
        </p>

        {unit && (
          <p className="mb-1 text-sm text-slate-500">
            {unit}
          </p>
        )}

      </div>

      <p className="mt-2 text-xs text-slate-600">
        {subtitle}
      </p>

    </div>
  );
}

function QuickAction({
  title,
  subtitle,
  icon,
  onClick,
}: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={
        onClick
      }
      className="rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-left transition hover:border-emerald-500/30 hover:bg-emerald-500/5"
    >

      <div className="text-emerald-400">
        {icon}
      </div>

      <p className="mt-4 font-semibold">
        {title}
      </p>

      <p className="mt-1 text-xs text-slate-500">
        {subtitle}
      </p>

    </button>
  );
}

function ProfileItem({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div>

      <p className="text-xs uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>

    </div>
  );
}

function MiniMetric({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">

      <p className="text-xs text-slate-600">
        {label}
      </p>

      <p
        className={`mt-1 font-semibold ${
          highlight
            ? "text-emerald-400"
            : "text-white"
        }`}
      >
        {value}
      </p>

    </div>
  );
}