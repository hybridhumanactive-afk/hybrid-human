"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
} from "firebase/firestore";

import {
  Activity,
  ArrowLeft,
  BatteryCharging,
  CheckCircle2,
  Clock3,
  Droplets,
  Dumbbell,
  Flame,
  Footprints,
  HeartPulse,
  Loader2,
  Moon,
  RefreshCw,
  Ruler,
  Scale,
  Smartphone,
  Thermometer,
  Watch,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

type DailyHealth = {
  date?: string;

  source?: string;

  steps?: number;

  latestHeartRate?: number;

  restingHeartRate?: number;

  sleepMinutes?: number;

  sleepScore?: number;

  distanceKm?: number;

  activeMinutes?: number;

  activeCalories?: number;

  bloodOxygen?: number;

  weightKg?: number;

  bodyFatPercentage?: number;

  skeletalMuscleMassKg?: number;

  skinTemperatureC?: number;

  exerciseCount30Days?: number;
};

type SamsungConnection = {
  provider?: string;

  status?: string;

  lastSyncAt?: {
    toDate?: () => Date;
  };

  updatedAt?: {
    toDate?: () => Date;
  };
};

export default function SamsungIntegrationPage() {
  const router =
    useRouter();

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [dailyHealth, setDailyHealth] =
    useState<DailyHealth | null>(
      null
    );

  const [connection, setConnection] =
    useState<SamsungConnection | null>(
      null
    );

  const [error, setError] =
    useState("");

  const [userId, setUserId] =
    useState("");

  async function loadSamsungData(
    uid: string
  ) {
    try {
      setError("");

      const today =
        new Date()
          .toISOString()
          .slice(
            0,
            10
          );

      const healthReference =
        doc(
          db,
          "users",
          uid,
          "dailyHealth",
          today
        );

      const connectionReference =
        doc(
          db,
          "users",
          uid,
          "deviceConnections",
          "samsung"
        );

      const [
        healthSnapshot,
        connectionSnapshot,
      ] =
        await Promise.all([
          getDoc(
            healthReference
          ),

          getDoc(
            connectionReference
          ),
        ]);

      if (
        healthSnapshot.exists()
      ) {
        setDailyHealth(
          healthSnapshot.data() as DailyHealth
        );
      } else {
        setDailyHealth(
          null
        );
      }

      if (
        connectionSnapshot.exists()
      ) {
        setConnection(
          connectionSnapshot.data() as SamsungConnection
        );
      } else {
        setConnection(
          null
        );
      }
    } catch (error) {
      console.error(
        "Samsung Health load error:",
        error
      );

      setError(
        "Could not load Samsung Health data."
      );
    }
  }

  async function refresh() {
    if (!userId) {
      return;
    }

    setRefreshing(true);

    await loadSamsungData(
      userId
    );

    setRefreshing(false);
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

          setUserId(
            user.uid
          );

          await loadSamsungData(
            user.uid
          );

          setLoading(
            false
          );
        }
      );

    return () => {
      unsubscribe();
    };
  }, [router]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading Samsung Health...

      </main>
    );
  }

  const connected =
    connection?.status ===
    "connected";

  const lastSync =
    formatFirebaseDate(
      connection?.lastSyncAt
    );

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-7xl">

        <button
          type="button"
          onClick={() =>
            router.push(
              "/devices"
            )
          }
          className="mb-8 flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >

          <ArrowLeft
            size={17}
          />

          Connected Devices

        </button>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-[#091610]">

          <div className="border-b border-white/10 p-7 md:p-9">

            <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center">

              <div className="flex items-center gap-5">

                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-500 text-black">

                  <Watch
                    size={32}
                  />

                </div>

                <div>

                  <div className="flex flex-wrap items-center gap-3">

                    <h1 className="text-3xl font-bold">
                      Samsung Health
                    </h1>

                    {connected ? (
                      <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">

                        <CheckCircle2
                          size={14}
                        />

                        Connected

                      </div>
                    ) : (
                      <div className="rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
                        Not connected
                      </div>
                    )}

                  </div>

                  <p className="mt-2 text-slate-400">
                    Samsung Health Data SDK integration
                  </p>

                </div>

              </div>

              <button
                type="button"
                onClick={
                  refresh
                }
                disabled={
                  refreshing
                }
                className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 text-sm font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >

                <RefreshCw
                  size={17}
                  className={
                    refreshing
                      ? "animate-spin"
                      : ""
                  }
                />

                {refreshing
                  ? "Refreshing..."
                  : "Refresh Data"}

              </button>

            </div>

          </div>

          <div className="grid gap-px bg-white/10 sm:grid-cols-2 lg:grid-cols-4">

            <StatusItem
              icon={
                <Smartphone
                  size={20}
                />
              }
              label="Provider"
              value="Samsung Health"
            />

            <StatusItem
              icon={
                <CheckCircle2
                  size={20}
                />
              }
              label="Connection"
              value={
                connected
                  ? "Connected"
                  : "Offline"
              }
            />

            <StatusItem
              icon={
                <Clock3
                  size={20}
                />
              }
              label="Last sync"
              value={
                lastSync ||
                "Not synced"
              }
            />

            <StatusItem
              icon={
                <BatteryCharging
                  size={20}
                />
              }
              label="Data source"
              value={
                dailyHealth?.source ===
                "samsung"
                  ? "Samsung SDK"
                  : "Waiting"
              }
            />

          </div>

        </section>

        {error && (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-300">
            {error}
          </div>
        )}

        <div className="mt-10">

          <div className="flex items-end justify-between">

            <div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Daily Health
              </p>

              <h2 className="mt-2 text-2xl font-bold">
                Today&apos;s metrics
              </h2>

            </div>

            <p className="hidden text-sm text-slate-500 sm:block">
              {
                dailyHealth?.date ??
                "Today"
              }
            </p>

          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">

            <MetricCard
              icon={
                <Footprints
                  size={22}
                />
              }
              title="Steps"
              value={
                formatNumber(
                  dailyHealth?.steps
                )
              }
              unit="steps"
              available={
                dailyHealth?.steps !==
                undefined
              }
            />

            <MetricCard
              icon={
                <HeartPulse
                  size={22}
                />
              }
              title="Heart Rate"
              value={
                formatNumber(
                  dailyHealth?.latestHeartRate
                )
              }
              unit="bpm"
              available={
                dailyHealth?.latestHeartRate !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Moon
                  size={22}
                />
              }
              title="Sleep"
              value={
                formatSleep(
                  dailyHealth?.sleepMinutes
                )
              }
              unit={
                dailyHealth?.sleepScore
                  ? `Score ${dailyHealth.sleepScore}`
                  : ""
              }
              available={
                dailyHealth?.sleepMinutes !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Ruler
                  size={22}
                />
              }
              title="Distance"
              value={
                formatDecimal(
                  dailyHealth?.distanceKm,
                  2
                )
              }
              unit="km"
              available={
                dailyHealth?.distanceKm !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Activity
                  size={22}
                />
              }
              title="Active Time"
              value={
                formatNumber(
                  dailyHealth?.activeMinutes
                )
              }
              unit="minutes"
              available={
                dailyHealth?.activeMinutes !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Flame
                  size={22}
                />
              }
              title="Active Calories"
              value={
                formatNumber(
                  dailyHealth?.activeCalories
                )
              }
              unit="kcal"
              available={
                dailyHealth?.activeCalories !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Droplets
                  size={22}
                />
              }
              title="Blood Oxygen"
              value={
                formatDecimal(
                  dailyHealth?.bloodOxygen,
                  1
                )
              }
              unit="%"
              available={
                dailyHealth?.bloodOxygen !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Scale
                  size={22}
                />
              }
              title="Weight"
              value={
                formatDecimal(
                  dailyHealth?.weightKg,
                  1
                )
              }
              unit="kg"
              available={
                dailyHealth?.weightKg !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Activity
                  size={22}
                />
              }
              title="Body Fat"
              value={
                formatDecimal(
                  dailyHealth?.bodyFatPercentage,
                  1
                )
              }
              unit="%"
              available={
                dailyHealth?.bodyFatPercentage !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Dumbbell
                  size={22}
                />
              }
              title="Skeletal Muscle"
              value={
                formatDecimal(
                  dailyHealth?.skeletalMuscleMassKg,
                  1
                )
              }
              unit="kg"
              available={
                dailyHealth?.skeletalMuscleMassKg !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Thermometer
                  size={22}
                />
              }
              title="Skin Temperature"
              value={
                formatDecimal(
                  dailyHealth?.skinTemperatureC,
                  1
                )
              }
              unit="°C"
              available={
                dailyHealth?.skinTemperatureC !==
                undefined
              }
            />

            <MetricCard
              icon={
                <Dumbbell
                  size={22}
                />
              }
              title="Workouts"
              value={
                formatNumber(
                  dailyHealth?.exerciseCount30Days
                )
              }
              unit="last 30 days"
              available={
                dailyHealth?.exerciseCount30Days !==
                undefined
              }
            />

          </div>

        </div>

        <section className="mt-10 rounded-3xl border border-white/10 bg-white/[0.025] p-6 md:p-8">

          <div className="flex items-start gap-4">

            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">

              <RefreshCw
                size={22}
              />

            </div>

            <div>

              <h2 className="text-lg font-semibold">
                Hybrid Human Sync Pipeline
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Samsung Health data is collected by the
                Hybrid Human Android companion app and
                securely synchronized to the Hybrid Human
                platform through Firebase. Metrics become
                available here as soon as the connected
                device provides them.
              </p>

            </div>

          </div>

          <div className="mt-7 grid gap-3 md:grid-cols-4">

            <PipelineStep
              number="01"
              title="Samsung Health"
              description="Wearable and phone data"
            />

            <PipelineStep
              number="02"
              title="Hybrid Human App"
              description="Permission and health sync"
            />

            <PipelineStep
              number="03"
              title="Cloud Platform"
              description="Secure data storage"
            />

            <PipelineStep
              number="04"
              title="Hybrid Intelligence"
              description="Points, recovery and insights"
            />

          </div>

        </section>

      </div>

    </main>
  );
}

function MetricCard({
  icon,
  title,
  value,
  unit,
  available,
}: {
  icon: React.ReactNode;

  title: string;

  value: string;

  unit: string;

  available: boolean;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.025] p-5">

      <div className="flex items-center justify-between">

        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
          {icon}
        </div>

        <div
          className={`h-2.5 w-2.5 rounded-full ${
            available
              ? "bg-emerald-400"
              : "bg-slate-700"
          }`}
        />

      </div>

      <p className="mt-5 text-sm text-slate-500">
        {title}
      </p>

      {available ? (
        <div className="mt-2">

          <span className="text-2xl font-bold">
            {value}
          </span>

          {unit && (
            <span className="ml-2 text-xs text-slate-500">
              {unit}
            </span>
          )}

        </div>
      ) : (
        <div className="mt-2">

          <p className="font-semibold text-slate-500">
            Not synced yet
          </p>

          <p className="mt-1 text-xs text-slate-600">
            Awaiting wearable data
          </p>

        </div>
      )}

    </div>
  );
}

function StatusItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;

  label: string;

  value: string;
}) {
  return (
    <div className="bg-[#091610] p-5">

      <div className="text-emerald-400">
        {icon}
      </div>

      <p className="mt-3 text-xs uppercase tracking-wider text-slate-600">
        {label}
      </p>

      <p className="mt-1 font-semibold">
        {value}
      </p>

    </div>
  );
}

function PipelineStep({
  number,
  title,
  description,
}: {
  number: string;

  title: string;

  description: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-5">

      <p className="text-xs font-bold text-emerald-400">
        {number}
      </p>

      <h3 className="mt-3 font-semibold">
        {title}
      </h3>

      <p className="mt-1 text-xs leading-5 text-slate-500">
        {description}
      </p>

    </div>
  );
}

function formatNumber(
  value:
    | number
    | undefined
) {
  if (
    value === undefined
  ) {
    return "--";
  }

  return new Intl.NumberFormat(
    "en-ZA"
  ).format(
    value
  );
}

function formatDecimal(
  value:
    | number
    | undefined,

  decimals: number
) {
  if (
    value === undefined
  ) {
    return "--";
  }

  return value.toFixed(
    decimals
  );
}

function formatSleep(
  minutes:
    | number
    | undefined
) {
  if (
    minutes === undefined
  ) {
    return "--";
  }

  const hours =
    Math.floor(
      minutes / 60
    );

  const remaining =
    minutes % 60;

  return `${hours}h ${remaining}m`;
}

function formatFirebaseDate(
  value:
    | SamsungConnection["lastSyncAt"]
    | undefined
) {
  if (
    !value?.toDate
  ) {
    return "";
  }

  try {
    return value
      .toDate()
      .toLocaleString(
        "en-ZA",
        {
          dateStyle:
            "medium",

          timeStyle:
            "short",
        }
      );
  } catch {
    return "";
  }
}