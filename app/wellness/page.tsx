"use client";

import {
  FormEvent,
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
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  ArrowLeft,
  Battery,
  Check,
  Dumbbell,
  Frown,
  GlassWater,
  HeartPulse,
  Loader2,
  Moon,
  Smile,
  Sparkles,
  Zap,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

type WellnessForm = {
  mood: number;
  energy: number;
  stress: number;
  soreness: number;
  sleepQuality: number;
  alcoholDrinks: number;
  lateNight: boolean;
  illness: boolean;
  notes: string;
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

export default function WellnessPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [saved, setSaved] =
    useState(false);

  const [error, setError] =
    useState("");

  const [form, setForm] =
    useState<WellnessForm>({
      mood: 3,
      energy: 5,
      stress: 5,
      soreness: 5,
      sleepQuality: 5,
      alcoholDrinks: 0,
      lateNight: false,
      illness: false,
      notes: "",
    });

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
            const today =
              getTodayKey();

            const reference =
              doc(
                db,
                "users",
                user.uid,
                "wellnessCheckIns",
                today
              );

            const snapshot =
              await getDoc(reference);

            if (snapshot.exists()) {
              const data =
                snapshot.data();

              setForm({
                mood:
                  data.mood ?? 3,

                energy:
                  data.energy ?? 5,

                stress:
                  data.stress ?? 5,

                soreness:
                  data.soreness ?? 5,

                sleepQuality:
                  data.sleepQuality ?? 5,

                alcoholDrinks:
                  data.alcoholDrinks ?? 0,

                lateNight:
                  data.lateNight ?? false,

                illness:
                  data.illness ?? false,

                notes:
                  data.notes ?? "",
              });

              setSaved(true);
            }
          } catch (error) {
            console.error(
              "Unable to load wellness check-in:",
              error
            );
          } finally {
            setLoading(false);
          }
        }
      );

    return () =>
      unsubscribe();
  }, [router]);

  function updateField<
    K extends keyof WellnessForm
  >(
    field: K,
    value: WellnessForm[K]
  ) {
    setForm(
      (current) => ({
        ...current,
        [field]: value,
      })
    );

    setSaved(false);
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>
  ) {
    event.preventDefault();

    const user =
      auth.currentUser;

    if (!user) {
      router.replace("/login");
      return;
    }

    setError("");
    setSaving(true);

    try {
      const today =
        getTodayKey();

      const reference =
        doc(
          db,
          "users",
          user.uid,
          "wellnessCheckIns",
          today
        );

      await setDoc(
        reference,
        {
          uid:
            user.uid,

          date:
            today,

          mood:
            form.mood,

          energy:
            form.energy,

          stress:
            form.stress,

          soreness:
            form.soreness,

          sleepQuality:
            form.sleepQuality,

          alcoholDrinks:
            form.alcoholDrinks,

          lateNight:
            form.lateNight,

          illness:
            form.illness,

          notes:
            form.notes.trim(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setSaved(true);
    } catch (error) {
      console.error(
        "Wellness save error:",
        error
      );

      setError(
        "We could not save your check-in. Please try again."
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">
        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading wellness check-in...
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-4xl">

        <button
          onClick={() =>
            router.push("/dashboard")
          }
          className="mb-8 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={17} />

          Dashboard
        </button>

        <header className="mb-9 flex items-center gap-4">

          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500 text-black">
            <HeartPulse size={27} />
          </div>

          <div>

            <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
              Daily Wellness
            </p>

            <h1 className="mt-1 text-3xl font-bold">
              How are you feeling today?
            </h1>

          </div>

        </header>

        <div className="mb-8 rounded-3xl border border-emerald-500/20 bg-emerald-500/5 p-6">

          <div className="flex items-start gap-4">

            <Sparkles
              className="mt-1 shrink-0 text-emerald-400"
              size={22}
            />

            <div>

              <h2 className="font-semibold">
                Your daily context matters
              </h2>

              <p className="mt-2 text-sm leading-6 text-slate-400">
                Wearables tell us what happened
                physically. Your check-in helps us
                understand how you actually felt and
                what may have influenced your recovery.
              </p>

            </div>

          </div>

        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        {saved && (
          <div className="mb-6 flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-300">

            <Check size={18} />

            Today&apos;s wellness check-in has been saved.

          </div>
        )}

        <form
          onSubmit={handleSubmit}
          className="space-y-6"
        >

          {/* MOOD */}

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <div className="mb-6">

              <h2 className="text-xl font-semibold">
                Overall mood
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                How do you feel overall this morning?
              </p>

            </div>

            <div className="grid grid-cols-5 gap-2">

              {[
                {
                  value: 1,
                  label: "Very low",
                  emoji: "😫",
                },
                {
                  value: 2,
                  label: "Low",
                  emoji: "😕",
                },
                {
                  value: 3,
                  label: "Okay",
                  emoji: "😐",
                },
                {
                  value: 4,
                  label: "Good",
                  emoji: "🙂",
                },
                {
                  value: 5,
                  label: "Great",
                  emoji: "😄",
                },
              ].map(
                (option) => (
                  <button
                    key={
                      option.value
                    }
                    type="button"
                    onClick={() =>
                      updateField(
                        "mood",
                        option.value
                      )
                    }
                    className={`rounded-2xl border p-3 text-center transition ${
                      form.mood ===
                      option.value
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-white/10 bg-black/10 hover:bg-white/5"
                    }`}
                  >

                    <div className="text-2xl">
                      {option.emoji}
                    </div>

                    <p className="mt-2 hidden text-xs text-slate-400 sm:block">
                      {option.label}
                    </p>

                  </button>
                )
              )}

            </div>

          </section>

          <SliderCard
            icon={
              <Battery size={20} />
            }
            title="Energy"
            description="How energetic do you feel?"
            value={form.energy}
            lowLabel="Exhausted"
            highLabel="Excellent"
            onChange={(value) =>
              updateField(
                "energy",
                value
              )
            }
          />

          <SliderCard
            icon={
              <Zap size={20} />
            }
            title="Stress"
            description="How stressed do you feel?"
            value={form.stress}
            lowLabel="Relaxed"
            highLabel="Very stressed"
            onChange={(value) =>
              updateField(
                "stress",
                value
              )
            }
          />

          <SliderCard
            icon={
              <Dumbbell size={20} />
            }
            title="Muscle soreness"
            description="How sore does your body feel?"
            value={form.soreness}
            lowLabel="Fresh"
            highLabel="Very sore"
            onChange={(value) =>
              updateField(
                "soreness",
                value
              )
            }
          />

          <SliderCard
            icon={
              <Moon size={20} />
            }
            title="Sleep quality"
            description="How would you rate last night's sleep?"
            value={form.sleepQuality}
            lowLabel="Very poor"
            highLabel="Excellent"
            onChange={(value) =>
              updateField(
                "sleepQuality",
                value
              )
            }
          />

          {/* LIFESTYLE */}

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <div className="mb-6">

              <h2 className="text-xl font-semibold">
                Last night
              </h2>

              <p className="mt-1 text-sm text-slate-500">
                Things that may influence today&apos;s recovery.
              </p>

            </div>

            <div className="grid gap-5 sm:grid-cols-2">

              <div>

                <label
                  htmlFor="alcohol"
                  className="mb-2 flex items-center gap-2 text-sm text-slate-300"
                >
                  <GlassWater
                    size={17}
                    className="text-emerald-400"
                  />

                  Alcoholic drinks
                </label>

                <input
                  id="alcohol"
                  type="number"
                  min="0"
                  max="30"
                  value={
                    form.alcoholDrinks
                  }
                  onChange={(event) =>
                    updateField(
                      "alcoholDrinks",
                      Math.max(
                        0,
                        Number(
                          event
                            .target
                            .value
                        )
                      )
                    )
                  }
                  className="h-12 w-full rounded-xl border border-white/10 bg-black/20 px-4 text-white outline-none focus:border-emerald-500"
                />

              </div>

              <div className="space-y-3 pt-1 sm:pt-7">

                <ToggleOption
                  label="I went to bed later than usual"
                  checked={
                    form.lateNight
                  }
                  onChange={() =>
                    updateField(
                      "lateNight",
                      !form.lateNight
                    )
                  }
                />

                <ToggleOption
                  label="I feel sick / unwell"
                  checked={
                    form.illness
                  }
                  onChange={() =>
                    updateField(
                      "illness",
                      !form.illness
                    )
                  }
                />

              </div>

            </div>

          </section>

          {/* NOTES */}

          <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <label
              htmlFor="notes"
              className="text-lg font-semibold"
            >
              Anything else?
            </label>

            <p className="mt-1 text-sm text-slate-500">
              For example: difficult day at work,
              travelled, trained late, felt anxious,
              slept somewhere different, etc.
            </p>

            <textarea
              id="notes"
              rows={5}
              value={
                form.notes
              }
              onChange={(event) =>
                updateField(
                  "notes",
                  event.target.value
                )
              }
              placeholder="Optional notes..."
              className="mt-5 w-full resize-none rounded-2xl border border-white/10 bg-black/20 p-4 text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-500"
            />

          </section>

          <button
            type="submit"
            disabled={saving}
            className="flex w-full items-center justify-center rounded-2xl bg-emerald-500 px-6 py-4 font-semibold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
          >

            {saving ? (
              <>
                <Loader2
                  className="mr-2 animate-spin"
                  size={19}
                />

                Saving check-in...
              </>
            ) : saved ? (
              <>
                <Check
                  className="mr-2"
                  size={19}
                />

                Update Today&apos;s Check-In
              </>
            ) : (
              "Save Today's Check-In"
            )}

          </button>

        </form>

      </div>

    </main>
  );
}

function SliderCard({
  icon,
  title,
  description,
  value,
  lowLabel,
  highLabel,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  value: number;
  lowLabel: string;
  highLabel: string;
  onChange: (
    value: number
  ) => void;
}) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

      <div className="flex items-start justify-between gap-4">

        <div className="flex gap-3">

          <div className="mt-1 text-emerald-400">
            {icon}
          </div>

          <div>

            <h2 className="text-lg font-semibold">
              {title}
            </h2>

            <p className="mt-1 text-sm text-slate-500">
              {description}
            </p>

          </div>

        </div>

        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-500/10 text-lg font-bold text-emerald-400">
          {value}
        </div>

      </div>

      <input
        type="range"
        min="1"
        max="10"
        value={value}
        onChange={(event) =>
          onChange(
            Number(
              event.target.value
            )
          )
        }
        className="mt-7 w-full accent-emerald-500"
      />

      <div className="mt-2 flex justify-between text-xs text-slate-600">

        <span>
          {lowLabel}
        </span>

        <span>
          {highLabel}
        </span>

      </div>

    </section>
  );
}

function ToggleOption({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      className={`flex w-full items-center justify-between rounded-xl border px-4 py-3 text-left text-sm transition ${
        checked
          ? "border-emerald-500/40 bg-emerald-500/10"
          : "border-white/10 bg-black/10 hover:bg-white/5"
      }`}
    >

      <span>
        {label}
      </span>

      <div
        className={`flex h-6 w-6 items-center justify-center rounded-full border ${
          checked
            ? "border-emerald-500 bg-emerald-500 text-black"
            : "border-white/20"
        }`}
      >
        {checked && (
          <Check size={14} />
        )}
      </div>

    </button>
  );
}