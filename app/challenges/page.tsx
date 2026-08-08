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
  collection,
  getDocs,
} from "firebase/firestore";

import {
  ArrowLeft,
  CheckCircle2,
  Flame,
  Gift,
  Loader2,
  Lock,
  Target,
  Trophy,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  CHALLENGES,
} from "@/lib/challenges";

import {
  getCurrentWeekKey,
} from "@/lib/leaderboard";

type ChallengeProgress = {
  challengeId: string;
  challengeName?: string;
  description?: string;
  bonusPoints: number;
  completed: boolean;
  weekKey: string;
};

export default function ChallengesPage() {
  const router =
    useRouter();

  const [loading, setLoading] =
    useState(true);

  const [
    completedChallenges,
    setCompletedChallenges,
  ] = useState<
    ChallengeProgress[]
  >([]);

  const [error, setError] =
    useState("");

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
            const progressReference =
              collection(
                db,
                "users",
                user.uid,
                "challengeProgress"
              );

            const snapshot =
              await getDocs(
                progressReference
              );

            const weekKey =
              getCurrentWeekKey();

            const progress: ChallengeProgress[] =
              snapshot.docs
                .map(
                  (
                    progressDocument
                  ) => {
                    const data =
                      progressDocument.data();

                    return {
                      challengeId:
                        String(
                          data.challengeId ??
                            ""
                        ),

                      challengeName:
                        String(
                          data.challengeName ??
                            ""
                        ),

                      description:
                        String(
                          data.description ??
                            ""
                        ),

                      bonusPoints:
                        Number(
                          data.bonusPoints ??
                            0
                        ),

                      completed:
                        Boolean(
                          data.completed ??
                            false
                        ),

                      weekKey:
                        String(
                          data.weekKey ??
                            ""
                        ),
                    };
                  }
                )
                .filter(
                  (
                    item
                  ) =>
                    item.weekKey ===
                    weekKey &&
                    item.completed
                );

            setCompletedChallenges(
              progress
            );
          } catch (error) {
            console.error(
              "Challenge loading error:",
              error
            );

            setError(
              "We could not load your challenges."
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

  const totalBonusPoints =
    completedChallenges.reduce(
      (
        total,
        challenge
      ) =>
        total +
        challenge.bonusPoints,
      0
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading challenges...

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

        <header>

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Competition
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Challenges
          </h1>

          <p className="mt-3 max-w-2xl text-slate-500">
            Complete challenges during the week to
            earn bonus Hybrid Points.
          </p>

        </header>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">

          <SummaryCard
            label="Available"
            value={`${CHALLENGES.length}`}
            icon={
              <Target
                size={20}
              />
            }
          />

          <SummaryCard
            label="Completed"
            value={`${completedChallenges.length}`}
            icon={
              <Trophy
                size={20}
              />
            }
          />

          <SummaryCard
            label="Bonus Points"
            value={`${totalBonusPoints}`}
            icon={
              <Gift
                size={20}
              />
            }
          />

        </div>

        <div className="mt-8 grid gap-5 md:grid-cols-2 xl:grid-cols-3">

          {CHALLENGES.map(
            (
              challenge
            ) => {
              const completed =
                completedChallenges.some(
                  (
                    progress
                  ) =>
                    progress.challengeId ===
                    challenge.id
                );

              return (
                <div
                  key={
                    challenge.id
                  }
                  className={`rounded-3xl border p-6 transition ${
                    completed
                      ? "border-emerald-500/30 bg-emerald-500/10"
                      : "border-white/10 bg-white/[0.025]"
                  }`}
                >

                  <div className="flex items-center justify-between">

                    <div
                      className={`flex h-12 w-12 items-center justify-center rounded-2xl ${
                        completed
                          ? "bg-emerald-500 text-black"
                          : "bg-white/5 text-slate-400"
                      }`}
                    >

                      {completed ? (
                        <CheckCircle2
                          size={24}
                        />
                      ) : (
                        <Flame
                          size={24}
                        />
                      )}

                    </div>

                    <div className="rounded-full bg-amber-500/10 px-3 py-1 text-sm font-semibold text-amber-400">

                      +
                      {
                        challenge.bonusPoints
                      }{" "}
                      pts

                    </div>

                  </div>

                  <h2 className="mt-6 text-xl font-semibold">
                    {challenge.name}
                  </h2>

                  <p className="mt-3 min-h-16 text-sm leading-6 text-slate-500">
                    {
                      challenge.description
                    }
                  </p>

                  <div className="mt-6 border-t border-white/10 pt-4">

                    {completed ? (
                      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-400">

                        <CheckCircle2
                          size={17}
                        />

                        Completed this week

                      </p>
                    ) : (
                      <p className="flex items-center gap-2 text-sm text-slate-500">

                        <Lock
                          size={16}
                        />

                        Not completed yet

                      </p>
                    )}

                  </div>

                </div>
              );
            }
          )}

        </div>

      </div>

    </main>
  );
}

function SummaryCard({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
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