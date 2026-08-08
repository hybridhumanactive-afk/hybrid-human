"use client";

import {
  FormEvent,
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
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import {
  ArrowLeft,
  Check,
  HeartPulse,
  Loader2,
  Scale,
  TrendingDown,
  TrendingUp,
} from "lucide-react";

import {
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  auth,
  db,
} from "@/lib/firebase";

type WeightEntry = {
  id: string;
  date: string;
  weight: number;
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

function formatDate(
  dateString: string
) {
  const date = new Date(
    `${dateString}T00:00:00`
  );

  return date.toLocaleDateString(
    "en-ZA",
    {
      day: "2-digit",
      month: "short",
    }
  );
}

export default function WeightPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [weight, setWeight] =
    useState("");

  const [entries, setEntries] =
    useState<WeightEntry[]>([]);

  async function loadWeightHistory(
    userId: string
  ) {
    const weightReference =
      collection(
        db,
        "users",
        userId,
        "weightHistory"
      );

    const weightQuery =
      query(
        weightReference,
        orderBy(
          "date",
          "asc"
        )
      );

    const snapshot =
      await getDocs(
        weightQuery
      );

    const history =
      snapshot.docs.map(
        (document) => {
          const data =
            document.data();

          return {
            id:
              document.id,

            date:
              data.date,

            weight:
              Number(
                data.weight
              ),
          };
        }
      );

    setEntries(history);

    if (history.length > 0) {
      setWeight(
        String(
          history[
            history.length - 1
          ].weight
        )
      );
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

          try {
            await loadWeightHistory(
              user.uid
            );
          } catch (error) {
            console.error(
              "Unable to load weight history:",
              error
            );

            setError(
              "We could not load your weight history."
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

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

    const numericWeight =
      Number(weight);

    if (
      Number.isNaN(
        numericWeight
      ) ||
      numericWeight < 20 ||
      numericWeight > 400
    ) {
      setError(
        "Please enter a valid weight."
      );

      return;
    }

    setError("");
    setSaved(false);
    setSaving(true);

    try {
      const today =
        getTodayKey();

      const weightDocument =
        doc(
          db,
          "users",
          user.uid,
          "weightHistory",
          today
        );

      await setDoc(
        weightDocument,
        {
          uid:
            user.uid,

          date:
            today,

          weight:
            numericWeight,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      const userDocument =
        doc(
          db,
          "users",
          user.uid
        );

      await updateDoc(
        userDocument,
        {
          weight:
            numericWeight,

          updatedAt:
            serverTimestamp(),
        }
      );

      await loadWeightHistory(
        user.uid
      );

      setSaved(true);
    } catch (error) {
      console.error(
        "Weight save error:",
        error
      );

      setError(
        "We could not save your weight."
      );
    } finally {
      setSaving(false);
    }
  }

  const currentWeight =
    entries.length > 0
      ? entries[
          entries.length - 1
        ].weight
      : null;

  const startingWeight =
    entries.length > 0
      ? entries[0].weight
      : null;

  const weightChange =
    currentWeight !== null &&
    startingWeight !== null
      ? Number(
          (
            currentWeight -
            startingWeight
          ).toFixed(1)
        )
      : 0;

  const chartData =
    useMemo(
      () =>
        entries.map(
          (entry) => ({
            ...entry,
            label:
              formatDate(
                entry.date
              ),
          })
        ),
      [entries]
    );

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading weight history...

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

        <header className="mb-9 flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black">

            <HeartPulse
              size={27}
            />

          </div>

          <div>

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Body metrics
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              Weight History
            </h1>

          </div>

        </header>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">

            <Check
              size={18}
            />

            Your weight has been saved.

          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[340px_1fr]">

          <div className="space-y-6">

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

              <div className="flex items-center gap-3">

                <Scale
                  className="text-emerald-400"
                  size={22}
                />

                <div>

                  <p className="text-sm text-slate-500">
                    Current weight
                  </p>

                  <p className="mt-1 text-3xl font-bold">
                    {currentWeight !== null
                      ? `${currentWeight} kg`
                      : "--"}
                  </p>

                </div>

              </div>

              {entries.length > 1 && (
                <div className="mt-6 border-t border-white/10 pt-5">

                  <p className="text-xs uppercase tracking-wider text-slate-600">
                    Change
                  </p>

                  <div className="mt-2 flex items-center gap-2">

                    {weightChange < 0 ? (
                      <TrendingDown
                        className="text-emerald-400"
                        size={18}
                      />
                    ) : weightChange > 0 ? (
                      <TrendingUp
                        className="text-amber-400"
                        size={18}
                      />
                    ) : null}

                    <p className="font-semibold">
                      {weightChange > 0
                        ? "+"
                        : ""}
                      {weightChange} kg
                    </p>

                  </div>

                  <p className="mt-1 text-xs text-slate-600">
                    Since your first recorded entry
                  </p>

                </div>
              )}

            </section>

            <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

              <h2 className="text-lg font-semibold">
                Record weight
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                One entry is stored per day.
              </p>

              <form
                onSubmit={
                  handleSubmit
                }
                className="mt-6"
              >

                <label
                  htmlFor="weight"
                  className="mb-2 block text-sm text-slate-300"
                >
                  Weight (kg)
                </label>

                <input
                  id="weight"
                  type="number"
                  min="20"
                  max="400"
                  step="0.1"
                  required
                  value={weight}
                  onChange={(
                    event
                  ) => {
                    setWeight(
                      event.target.value
                    );

                    setSaved(false);
                  }}
                  placeholder="e.g. 77.5"
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
                />

                <button
                  type="submit"
                  disabled={
                    saving
                  }
                  className="mt-4 flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-semibold text-black transition hover:bg-emerald-400 disabled:opacity-60"
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
                    "Save Weight"
                  )}

                </button>

              </form>

            </section>

          </div>

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <div>

              <p className="text-sm text-slate-500">
                Progress
              </p>

              <h2 className="mt-1 text-xl font-semibold">
                Weight over time
              </h2>

            </div>

            {chartData.length === 0 ? (
              <div className="flex h-[420px] items-center justify-center">

                <div className="text-center">

                  <Scale
                    size={38}
                    className="mx-auto text-slate-700"
                  />

                  <p className="mt-4 font-medium">
                    No weight history yet
                  </p>

                  <p className="mt-2 text-sm text-slate-500">
                    Record your first weight to start your graph.
                  </p>

                </div>

              </div>
            ) : (
              <div className="mt-8 h-[360px] w-full">

                <ResponsiveContainer
                  width="100%"
                  height="100%"
                >

                  <LineChart
                    data={
                      chartData
                    }
                    margin={{
                      top: 10,
                      right: 20,
                      left: 0,
                      bottom: 10,
                    }}
                  >

                    <XAxis
                      dataKey="label"
                      tick={{
                        fill:
                          "#64748b",
                        fontSize:
                          12,
                      }}
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                    />

                    <YAxis
                      domain={[
                        "dataMin - 2",
                        "dataMax + 2",
                      ]}
                      tick={{
                        fill:
                          "#64748b",
                        fontSize:
                          12,
                      }}
                      axisLine={
                        false
                      }
                      tickLine={
                        false
                      }
                      width={45}
                    />

                    <Tooltip
                      contentStyle={{
                        background:
                          "#0b1712",
                        border:
                          "1px solid rgba(255,255,255,0.1)",
                        borderRadius:
                          "12px",
                      }}
                      labelStyle={{
                        color:
                          "#94a3b8",
                      }}
                      formatter={(
                        value
                      ) => [
                        `${value} kg`,
                        "Weight",
                      ]}
                    />

                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="#10b981"
                      strokeWidth={3}
                      dot={{
                        r: 4,
                        fill:
                          "#10b981",
                      }}
                      activeDot={{
                        r: 6,
                      }}
                    />

                  </LineChart>

                </ResponsiveContainer>

              </div>
            )}

            {entries.length > 0 && (
              <div className="mt-8 border-t border-white/10 pt-6">

                <p className="mb-4 text-sm font-semibold">
                  Recent entries
                </p>

                <div className="space-y-3">

                  {[...entries]
                    .reverse()
                    .slice(0, 5)
                    .map(
                      (entry) => (
                        <div
                          key={
                            entry.id
                          }
                          className="flex items-center justify-between rounded-xl bg-black/10 px-4 py-3"
                        >

                          <span className="text-sm text-slate-400">
                            {new Date(
                              `${entry.date}T00:00:00`
                            ).toLocaleDateString(
                              "en-ZA",
                              {
                                day:
                                  "2-digit",
                                month:
                                  "long",
                                year:
                                  "numeric",
                              }
                            )}
                          </span>

                          <span className="font-semibold">
                            {entry.weight} kg
                          </span>

                        </div>
                      )
                    )}

                </div>

              </div>
            )}

          </section>

        </div>

      </div>

    </main>
  );
}