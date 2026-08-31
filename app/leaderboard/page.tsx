"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import { useRouter } from "next/navigation";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  collection,
  getDocs,
  orderBy,
  query,
  where,
} from "firebase/firestore";

import {
  ArrowLeft,
  Building2,
  Crown,
  Loader2,
  Medal,
  Trophy,
  Users,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

import {
  getCurrentMonthKey,
  getCurrentWeekKey,
  syncLeaderboard,
} from "@/lib/leaderboard";

type LeaderboardEntry = {
  uid: string;

  firstName: string;

  lastName: string;

  company: string;

  department: string;

  weeklyPoints: number;

  monthlyPoints: number;

  totalPoints: number;

  weeklyWorkouts: number;

  weekKey: string;

  monthKey: string;
};

type ViewMode =
  | "weekly"
  | "monthly"
  | "allTime";

export default function LeaderboardPage() {
  const router =
    useRouter();

  const [loading, setLoading] =
    useState(true);

  const [entries, setEntries] =
    useState<LeaderboardEntry[]>(
      []
    );

  const [currentUserId, setCurrentUserId] =
    useState("");

  const [viewMode, setViewMode] =
    useState<ViewMode>(
      "weekly"
    );

  const [error, setError] =
    useState("");

  async function loadLeaderboard() {
    const reference =
      collection(
        db,
        "leaderboardEntries"
      );

    const snapshot =
      await getDocs(
        reference
      );

    const results =
      snapshot.docs.map(
        (document) => {
          const data =
            document.data();

          return {
            uid:
              data.uid ||
              document.id,

            firstName:
              data.firstName ||
              "Athlete",

            lastName:
              data.lastName ||
              "",

            company:
              data.company ||
              "",

            department:
              data.department ||
              "",

            weeklyPoints:
              Number(
                data.weeklyPoints ||
                0
              ),

            monthlyPoints:
              Number(
                data.monthlyPoints ||
                0
              ),

            totalPoints:
              Number(
                data.totalPoints ||
                0
              ),

            weeklyWorkouts:
              Number(
                data.weeklyWorkouts ||
                0
              ),

            weekKey:
              data.weekKey ||
              "",

            monthKey:
              data.monthKey ||
              "",
          };
        }
      );

    setEntries(
      results
    );
  }

  async function syncGoogleFitBeforeLeaderboard(
    user: NonNullable<typeof auth.currentUser>
  ) {
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

            cache: "no-store",
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
          console.log(
            "Google Fit sync returned invalid JSON before leaderboard load."
          );

          return false;
        }
      }

      if (
        !response.ok ||
        !data.success
      ) {
        console.log(
          "Google Fit sync skipped before leaderboard load:",
          data.error ||
            `HTTP ${response.status}`
        );

        return false;
      }

      return true;
    } catch (error) {
      console.log(
        "Google Fit sync unavailable before leaderboard load:",
        error
      );

      return false;
    }
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

          setCurrentUserId(
            user.uid
          );

          try {
            await syncGoogleFitBeforeLeaderboard(
              user
            );

            await syncLeaderboard(
              user.uid
            );

            await loadLeaderboard();
          } catch (error) {
            console.error(
              "Leaderboard error:",
              error
            );

            setError(
              "We could not load the leaderboard."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  const sortedEntries =
    useMemo(() => {
      const weekKey =
        getCurrentWeekKey();

      const monthKey =
        getCurrentMonthKey();

      const filtered =
        entries.filter(
          (entry) => {
            if (
              viewMode ===
              "weekly"
            ) {
              return (
                entry.weekKey ===
                weekKey
              );
            }

            if (
              viewMode ===
              "monthly"
            ) {
              return (
                entry.monthKey ===
                monthKey
              );
            }

            return true;
          }
        );

      return [
        ...filtered,
      ].sort(
        (a, b) => {
          if (
            viewMode ===
            "weekly"
          ) {
            return (
              b.weeklyPoints -
              a.weeklyPoints
            );
          }

          if (
            viewMode ===
            "monthly"
          ) {
            return (
              b.monthlyPoints -
              a.monthlyPoints
            );
          }

          return (
            b.totalPoints -
            a.totalPoints
          );
        }
      );
    }, [
      entries,
      viewMode,
    ]);

  const currentUserRank =
    sortedEntries.findIndex(
      (entry) =>
        entry.uid ===
        currentUserId
    ) + 1;

  const currentUser =
    sortedEntries.find(
      (entry) =>
        entry.uid ===
        currentUserId
    );

  function getPoints(
    entry: LeaderboardEntry
  ) {
    if (
      viewMode ===
      "monthly"
    ) {
      return entry.monthlyPoints;
    }

    if (
      viewMode ===
      "allTime"
    ) {
      return entry.totalPoints;
    }

    return entry.weeklyPoints;
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading leaderboard...

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-6xl">

        <button
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
            Competition
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Leaderboard
          </h1>

          <p className="mt-3 text-slate-500">
            Compete with friends, colleagues and teams using real Hybrid Points.
          </p>

        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mb-6 flex flex-wrap gap-2">

          <PeriodButton
            label="This Week"
            active={
              viewMode ===
              "weekly"
            }
            onClick={() =>
              setViewMode(
                "weekly"
              )
            }
          />

          <PeriodButton
            label="This Month"
            active={
              viewMode ===
              "monthly"
            }
            onClick={() =>
              setViewMode(
                "monthly"
              )
            }
          />

          <PeriodButton
            label="All Time"
            active={
              viewMode ===
              "allTime"
            }
            onClick={() =>
              setViewMode(
                "allTime"
              )
            }
          />

        </div>

        <div className="grid gap-4 sm:grid-cols-3">

          <SummaryCard
            icon={
              <Trophy
                size={21}
              />
            }
            label="Your points"
            value={`${
              currentUser
                ? getPoints(
                    currentUser
                  )
                : 0
            }`}
          />

          <SummaryCard
            icon={
              <Medal
                size={21}
              />
            }
            label="Your rank"
            value={
              currentUserRank >
              0
                ? `#${currentUserRank}`
                : "--"
            }
          />

          <SummaryCard
            icon={
              <Users
                size={21}
              />
            }
            label="Participants"
            value={`${sortedEntries.length}`}
          />

        </div>

        {sortedEntries.length >=
          3 && (
          <section className="mt-6 grid gap-4 md:grid-cols-3">

            <PodiumCard
              position={2}
              entry={
                sortedEntries[1]
              }
              points={getPoints(
                sortedEntries[1]
              )}
            />

            <PodiumCard
              position={1}
              entry={
                sortedEntries[0]
              }
              points={getPoints(
                sortedEntries[0]
              )}
            />

            <PodiumCard
              position={3}
              entry={
                sortedEntries[2]
              }
              points={getPoints(
                sortedEntries[2]
              )}
            />

          </section>
        )}

        <section className="mt-6 overflow-hidden rounded-3xl border border-white/10 bg-white/[0.025]">

          <div className="flex items-center justify-between border-b border-white/10 p-6">

            <div>

              <p className="text-sm text-slate-500">
                Rankings
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Overall leaderboard
              </h2>

            </div>

            <Trophy className="text-emerald-400" />

          </div>

          {sortedEntries.length ===
          0 ? (
            <div className="flex min-h-80 items-center justify-center p-8">

              <div className="text-center">

                <Users
                  className="mx-auto text-slate-700"
                  size={40}
                />

                <p className="mt-4 font-medium">
                  No participants yet
                </p>

                <p className="mt-2 text-sm text-slate-500">
                  Add a workout to join the leaderboard.
                </p>

              </div>

            </div>
          ) : (
            <div className="divide-y divide-white/10">

              {sortedEntries.map(
                (
                  participant,
                  index
                ) => {
                  const isCurrentUser =
                    participant.uid ===
                    currentUserId;

                  const rank =
                    index + 1;

                  return (
                    <div
                      key={
                        participant.uid
                      }
                      className={`flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center ${
                        isCurrentUser
                          ? "bg-emerald-500/5"
                          : ""
                      }`}
                    >

                      <div className="flex items-center gap-4">

                        <RankBadge
                          rank={
                            rank
                          }
                        />

                        <div>

                          <div className="flex items-center gap-2">

                            <p className="font-semibold">
                              {
                                participant.firstName
                              }{" "}
                              {
                                participant.lastName
                              }
                            </p>

                            {isCurrentUser && (
                              <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs font-semibold text-emerald-400">
                                You
                              </span>
                            )}

                          </div>

                          {(participant.company ||
                            participant.department) && (
                            <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">

                              <Building2
                                size={13}
                              />

                              <span>
                                {participant.company ||
                                  "Personal"}

                                {participant.department
                                  ? ` • ${participant.department}`
                                  : ""}
                              </span>

                            </div>
                          )}

                        </div>

                      </div>

                      <div className="flex items-center gap-5">

                        {viewMode ===
                          "weekly" && (
                          <div className="text-right">

                            <p className="text-xs text-slate-600">
                              Workouts
                            </p>

                            <p className="font-semibold">
                              {
                                participant.weeklyWorkouts
                              }
                            </p>

                          </div>
                        )}

                        <div className="min-w-24 text-right">

                          <p className="text-xs text-slate-600">
                            Points
                          </p>

                          <p className="text-xl font-bold text-emerald-400">
                            {getPoints(
                              participant
                            )}
                          </p>

                        </div>

                      </div>

                    </div>
                  );
                }
              )}

            </div>
          )}

        </section>

      </div>

    </main>
  );
}

function PeriodButton({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={
        onClick
      }
      className={`rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
        active
          ? "bg-emerald-500 text-black"
          : "border border-white/10 bg-white/[0.025] text-slate-400 hover:text-white"
      }`}
    >
      {label}
    </button>
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

function RankBadge({
  rank,
}: {
  rank: number;
}) {
  if (rank === 1) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-amber-500/10 text-amber-400">
        <Crown
          size={20}
        />
      </div>
    );
  }

  if (
    rank === 2 ||
    rank === 3
  ) {
    return (
      <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 text-slate-300">
        <Medal
          size={20}
        />
      </div>
    );
  }

  return (
    <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/5 font-semibold text-slate-500">
      {rank}
    </div>
  );
}

function PodiumCard({
  position,
  entry,
  points,
}: {
  position: number;
  entry: LeaderboardEntry;
  points: number;
}) {
  return (
    <div
      className={`rounded-3xl border p-6 text-center ${
        position === 1
          ? "border-emerald-500/30 bg-emerald-500/10 md:-translate-y-3"
          : "border-white/10 bg-white/[0.025]"
      }`}
    >

      <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-black/20">

        {position === 1 ? (
          <Crown
            className="text-emerald-400"
            size={25}
          />
        ) : (
          <Medal
            className="text-slate-400"
            size={24}
          />
        )}

      </div>

      <p className="mt-4 text-xs uppercase tracking-wider text-slate-600">
        #{position}
      </p>

      <h3 className="mt-2 font-semibold">
        {entry.firstName}{" "}
        {entry.lastName}
      </h3>

      <p className="mt-2 text-2xl font-bold text-emerald-400">
        {points} pts
      </p>

    </div>
  );
}