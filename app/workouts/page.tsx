"use client";

import {
  FormEvent,
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import { onAuthStateChanged } from "firebase/auth";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  Activity,
  ArrowLeft,
  Check,
  Gift,
  HeartPulse,
  Loader2,
  MapPin,
  Plus,
  Timer,
  Trophy,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

import {
  calculateMaxHeartRate,
  scoreWorkout,
} from "@/lib/scoring";

import { syncLeaderboard } from "@/lib/leaderboard";

import {
  evaluateWorkoutChallenges,
  type EarnedChallenge,
} from "@/lib/challenges";

type UserProfile = {
  age: number;
};

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

function getTodayKey() {
  const now = new Date();

  const year = now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  const day = String(
    now.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export default function WorkoutsPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [age, setAge] =
    useState<number | null>(null);

  const [type, setType] =
    useState("Running");

  const [
    durationMinutes,
    setDurationMinutes,
  ] = useState("");

  const [
    distanceKm,
    setDistanceKm,
  ] = useState("");

  const [
    averageHeartRate,
    setAverageHeartRate,
  ] = useState("");

  const [workouts, setWorkouts] =
    useState<Workout[]>([]);

  const [
    earnedChallenges,
    setEarnedChallenges,
  ] = useState<EarnedChallenge[]>([]);

  async function loadWorkouts(
    userId: string
  ) {
    const workoutsReference =
      collection(
        db,
        "users",
        userId,
        "workouts"
      );

    const workoutsQuery =
      query(
        workoutsReference,
        orderBy(
          "date",
          "desc"
        )
      );

    const snapshot =
      await getDocs(
        workoutsQuery
      );

    const results: Workout[] =
      snapshot.docs.map(
        (workoutDocument) => {
          const data =
            workoutDocument.data();

          return {
            id:
              workoutDocument.id,

            date:
              data.date ?? "",

            type:
              data.type ?? "Other",

            durationMinutes:
              Number(
                data.durationMinutes ??
                  0
              ),

            distanceKm:
              Number(
                data.distanceKm ??
                  0
              ),

            averageHeartRate:
              Number(
                data.averageHeartRate ??
                  0
              ),

            maxHeartRate:
              Number(
                data.maxHeartRate ??
                  0
              ),

            heartRatePercentage:
              Number(
                data.heartRatePercentage ??
                  0
              ),

            heartRateZone:
              data.heartRateZone ??
              "",

            basePoints:
              Number(
                data.basePoints ??
                  data.points ??
                  0
              ),

            bonusPoints:
              Number(
                data.bonusPoints ??
                  0
              ),

            points:
              Number(
                data.points ??
                  0
              ),

            source:
              data.source ??
              "manual",
          };
        }
      );

    setWorkouts(results);
  }

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

            // FIXED TYPE ASSERTION
            const profile =
              profileSnapshot.data() as UserProfile;

            if (
              typeof profile.age !==
                "number" ||
              profile.age <= 0
            ) {
              setError(
                "Your age is missing from your profile. Please update your profile."
              );

              setLoading(false);

              return;
            }

            setAge(
              profile.age
            );

            await loadWorkouts(
              user.uid
            );

            await syncLeaderboard(
              user.uid
            );
          } catch (error) {
            console.error(
              "Workout loading error:",
              error
            );

            setError(
              "We could not load your workout data."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, [router]);

  const maxHeartRate =
    age !== null
      ? calculateMaxHeartRate(
          age
        )
      : 0;

  const scorePreview =
    useMemo(() => {
      if (
        age === null
      ) {
        return {
          maxHeartRate: 0,
          heartRatePercentage: 0,
          heartRateZone:
            "Below 50%",
          points: 0,
        };
      }

      return scoreWorkout({
        age,

        averageHeartRate:
          Number(
            averageHeartRate
          ),

        durationMinutes:
          Number(
            durationMinutes
          ),
      });
    }, [
      age,
      averageHeartRate,
      durationMinutes,
    ]);

  async function handleSubmit(
    event:
      FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const user =
      auth.currentUser;

    if (!user) {
      router.replace(
        "/login"
      );

      return;
    }

    if (
      age === null
    ) {
      setError(
        "Your profile age is missing."
      );

      return;
    }

    const duration =
      Number(
        durationMinutes
      );

    const averageHR =
      Number(
        averageHeartRate
      );

    const distance =
      Number(
        distanceKm || 0
      );

    if (
      Number.isNaN(
        duration
      ) ||
      duration <= 0
    ) {
      setError(
        "Please enter a valid workout duration."
      );

      return;
    }

    if (
      Number.isNaN(
        averageHR
      ) ||
      averageHR <= 0
    ) {
      setError(
        "Please enter a valid average heart rate."
      );

      return;
    }

    if (
      averageHR > 250
    ) {
      setError(
        "Please check your average heart rate."
      );

      return;
    }

    if (
      Number.isNaN(
        distance
      ) ||
      distance < 0
    ) {
      setError(
        "Please enter a valid distance."
      );

      return;
    }

    setSaving(true);
    setSaved(false);
    setError("");
    setEarnedChallenges([]);

    try {
      const today =
        getTodayKey();

      const score =
        scoreWorkout({
          age,

          averageHeartRate:
            averageHR,

          durationMinutes:
            duration,
        });

      const challengeResult =
        await evaluateWorkoutChallenges({
          userId:
            user.uid,

          workoutType:
            type,

          durationMinutes:
            duration,

          distanceKm:
            distance,

          heartRatePercentage:
            score.heartRatePercentage,
        });

      const totalPoints =
        score.points +
        challengeResult.totalBonusPoints;

      const workoutId =
        `${today}-${Date.now()}`;

      const workoutReference =
        doc(
          db,
          "users",
          user.uid,
          "workouts",
          workoutId
        );

      await setDoc(
        workoutReference,
        {
          uid:
            user.uid,

          date:
            today,

          type,

          durationMinutes:
            duration,

          distanceKm:
            distance,

          averageHeartRate:
            averageHR,

          maxHeartRate:
            score.maxHeartRate,

          heartRatePercentage:
            score.heartRatePercentage,

          heartRateZone:
            score.heartRateZone,

          basePoints:
            score.points,

          bonusPoints:
            challengeResult.totalBonusPoints,

          points:
            totalPoints,

          completedChallenges:
            challengeResult
              .earnedChallenges
              .map(
                (
                  challenge
                ) =>
                  challenge.id
              ),

          source:
            "manual",

          createdAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        }
      );

      await loadWorkouts(
        user.uid
      );

      await syncLeaderboard(
        user.uid
      );

      setEarnedChallenges(
        challengeResult
          .earnedChallenges
      );

      setDurationMinutes(
        ""
      );

      setDistanceKm(
        ""
      );

      setAverageHeartRate(
        ""
      );

      setSaved(true);
    } catch (error) {
      console.error(
        "Workout save error:",
        error
      );

      setError(
        "We could not save your workout."
      );
    } finally {
      setSaving(false);
    }
  }

  const totalPoints =
    workouts.reduce(
      (
        total,
        workout
      ) =>
        total +
        workout.points,
      0
    );

  const totalBonusPoints =
    workouts.reduce(
      (
        total,
        workout
      ) =>
        total +
        workout.bonusPoints,
      0
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading workouts...

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-6xl">

        <button
          type="button"
          onClick={() =>
            router.push(
              "/dashboard"
            )
          }
          className="mb-8 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft
            size={17}
          />

          Dashboard
        </button>

        <header className="mb-10">

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Activity
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Workouts
          </h1>

          <p className="mt-3 max-w-2xl text-slate-500">
            Record workouts and automatically
            earn performance points and
            challenge bonuses.
          </p>

        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">

            <div className="flex items-center gap-3">

              <Check
                size={18}
              />

              Workout saved and scored successfully.

            </div>

            {earnedChallenges.length >
              0 && (
              <div className="mt-4 space-y-2 border-t border-emerald-500/20 pt-4">

                <p className="font-semibold">
                  Bonus challenges completed:
                </p>

                {earnedChallenges.map(
                  (
                    challenge
                  ) => (
                    <div
                      key={
                        challenge.id
                      }
                      className="flex items-center justify-between"
                    >

                      <span>
                        {
                          challenge.name
                        }
                      </span>

                      <span className="font-bold">
                        +
                        {
                          challenge.bonusPoints
                        }{" "}
                        pts
                      </span>

                    </div>
                  )
                )}

              </div>
            )}

          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[380px_1fr]">

          {/* LEFT COLUMN */}

          <div className="space-y-6">

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

              <div className="flex items-center gap-3">

                <HeartPulse
                  className="text-emerald-400"
                  size={22}
                />

                <div>

                  <p className="text-sm text-slate-500">
                    Calculated max HR
                  </p>

                  <p className="text-3xl font-bold">
                    {maxHeartRate} bpm
                  </p>

                </div>

              </div>

              <p className="mt-4 text-xs text-slate-600">
                MVP calculation: 220 - age
              </p>

            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

              <div className="mb-6 flex items-center gap-3">

                <Plus
                  size={20}
                  className="text-emerald-400"
                />

                <div>

                  <h2 className="font-semibold">
                    Add workout
                  </h2>

                  <p className="text-sm text-slate-500">
                    Manual entry
                  </p>

                </div>

              </div>

              <form
                onSubmit={
                  handleSubmit
                }
                className="space-y-5"
              >

                {/* WORKOUT TYPE */}

                <div>

                  <label
                    htmlFor="type"
                    className="mb-2 block text-sm text-slate-300"
                  >
                    Workout type
                  </label>

                  <select
                    id="type"
                    value={type}
                    onChange={(
                      event
                    ) =>
                      setType(
                        event.target.value
                      )
                    }
                    className="h-12 w-full rounded-xl border border-white/10 bg-[#09130f] px-4 text-white outline-none focus:border-emerald-500"
                  >

                    <option value="Running">
                      Running
                    </option>

                    <option value="Walking">
                      Walking
                    </option>

                    <option value="Cycling">
                      Cycling
                    </option>

                    <option value="Gym">
                      Gym
                    </option>

                    <option value="Swimming">
                      Swimming
                    </option>

                    <option value="Other">
                      Other
                    </option>

                  </select>

                </div>

                {/* DURATION */}

                <div>

                  <label
                    htmlFor="duration"
                    className="mb-2 block text-sm text-slate-300"
                  >
                    Duration (minutes)
                  </label>

                  <input
                    id="duration"
                    type="number"
                    min="1"
                    required
                    value={
                      durationMinutes
                    }
                    onChange={(
                      event
                    ) =>
                      setDurationMinutes(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 60"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                  />

                </div>

                {/* DISTANCE */}

                <div>

                  <label
                    htmlFor="distance"
                    className="mb-2 block text-sm text-slate-300"
                  >
                    Distance (km)
                  </label>

                  <input
                    id="distance"
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      distanceKm
                    }
                    onChange={(
                      event
                    ) =>
                      setDistanceKm(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 10"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                  />

                </div>

                {/* HEART RATE */}

                <div>

                  <label
                    htmlFor="averageHR"
                    className="mb-2 block text-sm text-slate-300"
                  >
                    Average heart rate
                  </label>

                  <input
                    id="averageHR"
                    type="number"
                    min="30"
                    max="250"
                    required
                    value={
                      averageHeartRate
                    }
                    onChange={(
                      event
                    ) =>
                      setAverageHeartRate(
                        event.target.value
                      )
                    }
                    placeholder="e.g. 145"
                    className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none placeholder:text-slate-600 focus:border-emerald-500"
                  />

                </div>

                {/* SCORE PREVIEW */}

                <div className="grid grid-cols-2 gap-3">

                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4">

                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Intensity
                    </p>

                    <p className="mt-2 text-2xl font-bold">
                      {
                        scorePreview.heartRatePercentage
                      }
                      %
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      {
                        scorePreview.heartRateZone
                      }
                    </p>

                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/10 p-4">

                    <p className="text-xs uppercase tracking-wider text-slate-500">
                      Base Points
                    </p>

                    <p className="mt-2 text-2xl font-bold text-emerald-400">
                      {
                        scorePreview.points
                      }
                    </p>

                    <p className="mt-1 text-xs text-slate-600">
                      Before bonuses
                    </p>

                  </div>

                </div>

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
                >

                  {saving ? (
                    <>
                      <Loader2
                        className="mr-2 animate-spin"
                        size={18}
                      />

                      Saving...
                    </>
                  ) : (
                    "Save Workout"
                  )}

                </button>

              </form>

            </section>

          </div>

          {/* RIGHT COLUMN */}

          <div className="space-y-6">

            <div className="grid gap-4 sm:grid-cols-3">

              <SummaryCard
                icon={
                  <Activity
                    size={20}
                  />
                }
                label="Workouts"
                value={`${workouts.length}`}
              />

              <SummaryCard
                icon={
                  <Trophy
                    size={20}
                  />
                }
                label="Total Points"
                value={`${totalPoints}`}
              />

              <SummaryCard
                icon={
                  <Gift
                    size={20}
                  />
                }
                label="Bonus Points"
                value={`${totalBonusPoints}`}
              />

            </div>

            <section className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">

              <div className="border-b border-white/10 p-6">

                <p className="text-sm text-slate-500">
                  Activity history
                </p>

                <h2 className="mt-1 text-xl font-semibold">
                  Recent workouts
                </h2>

              </div>

              {workouts.length ===
              0 ? (
                <div className="flex min-h-80 items-center justify-center p-8">

                  <div className="text-center">

                    <Activity
                      className="mx-auto text-slate-700"
                      size={40}
                    />

                    <p className="mt-4 font-medium">
                      No workouts yet
                    </p>

                    <p className="mt-2 text-sm text-slate-500">
                      Add your first workout to test the Hybrid Human scoring engine.
                    </p>

                  </div>

                </div>
              ) : (
                <div className="divide-y divide-white/10">

                  {workouts.map(
                    (
                      workout
                    ) => (
                      <div
                        key={
                          workout.id
                        }
                        className="p-5"
                      >

                        <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">

                          <div>

                            <p className="font-semibold">
                              {
                                workout.type
                              }
                            </p>

                            <p className="mt-1 text-sm text-slate-500">
                              {
                                workout.date
                              }
                            </p>

                            <p className="mt-1 text-xs text-slate-600">
                              Source:{" "}
                              {
                                workout.source
                              }
                            </p>

                          </div>

                          <div className="flex flex-wrap gap-3 text-sm">

                            <WorkoutStat
                              icon={
                                <Timer
                                  size={16}
                                />
                              }
                              value={`${workout.durationMinutes} min`}
                            />

                            {workout.distanceKm >
                              0 && (
                              <WorkoutStat
                                icon={
                                  <MapPin
                                    size={16}
                                  />
                                }
                                value={`${workout.distanceKm} km`}
                              />
                            )}

                            <WorkoutStat
                              icon={
                                <HeartPulse
                                  size={16}
                                />
                              }
                              value={`${workout.averageHeartRate} bpm`}
                            />

                            <WorkoutStat
                              icon={
                                <Activity
                                  size={16}
                                />
                              }
                              value={`${workout.heartRatePercentage}%`}
                            />

                            <div className="rounded-xl bg-white/5 px-3 py-2 text-slate-400">
                              Base{" "}
                              {
                                workout.basePoints
                              }
                            </div>

                            {workout.bonusPoints >
                              0 && (
                              <div className="rounded-xl bg-amber-500/10 px-3 py-2 font-semibold text-amber-400">

                                +
                                {
                                  workout.bonusPoints
                                }{" "}
                                Bonus

                              </div>
                            )}

                            <div className="rounded-xl bg-emerald-500/10 px-3 py-2 font-semibold text-emerald-400">

                              {
                                workout.points
                              }{" "}
                              pts

                            </div>

                          </div>

                        </div>

                      </div>
                    )
                  )}

                </div>
              )}

            </section>

          </div>

        </div>

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

      <span>
        {value}
      </span>

    </div>
  );
}