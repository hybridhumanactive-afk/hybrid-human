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
  CheckCircle2,
  Clock3,
  HeartPulse,
  Loader2,
  RefreshCw,
  Smartphone,
  Watch,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

type GoogleFitStatus =
  | "not_connected"
  | "pending"
  | "connected"
  | "error";

export default function DevicesPage() {
  const router =
    useRouter();

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(false);

  const [
    googleFitStatus,
    setGoogleFitStatus,
  ] =
    useState<GoogleFitStatus>(
      "not_connected"
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  async function loadGoogleFitConnection(
    userId: string
  ) {
    try {
      const reference =
        doc(
          db,
          "users",
          userId,
          "deviceConnections",
          "google_fit"
        );

      const snapshot =
        await getDoc(
          reference
        );

      if (
        !snapshot.exists()
      ) {
        setGoogleFitStatus(
          "not_connected"
        );

        return;
      }

      const data =
        snapshot.data();

      const status =
        data.status as
          | GoogleFitStatus
          | undefined;

      setGoogleFitStatus(
        status ??
          "not_connected"
      );
    } catch (error) {
      console.error(
        "Google Fit connection loading error:",
        error
      );

      setGoogleFitStatus(
        "error"
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
            await loadGoogleFitConnection(
              user.uid
            );
          } catch (error) {
            console.error(
              "Device loading error:",
              error
            );

            setMessage(
              "Could not load your device connections."
            );
          } finally {
            setLoading(
              false
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, [router]);

  async function refreshConnections() {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    setRefreshing(
      true
    );

    setMessage(
      ""
    );

    try {
      await loadGoogleFitConnection(
        user.uid
      );

      setMessage(
        "Device connection status refreshed."
      );
    } catch (error) {
      console.error(
        "Refresh error:",
        error
      );

      setMessage(
        "Could not refresh your device connection."
      );
    } finally {
      setRefreshing(
        false
      );
    }
  }

  function openGoogleFit() {
    router.push(
      "/integrations/google-fit"
    );
  }

  if (
    loading
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading devices...

      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-7xl">

        <div className="mb-8 flex items-center justify-between gap-4">

          <button
            type="button"
            onClick={() =>
              router.push(
                "/dashboard"
              )
            }
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >

            <ArrowLeft
              size={17}
            />

            Dashboard

          </button>

          <button
            type="button"
            onClick={
              refreshConnections
            }
            disabled={
              refreshing
            }
            className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-slate-300 transition hover:bg-white/[0.06] hover:text-white disabled:opacity-50"
          >

            <RefreshCw
              size={16}
              className={
                refreshing
                  ? "animate-spin"
                  : ""
              }
            />

            Refresh

          </button>

        </div>

        <header className="mb-10">

          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
            Integrations
          </p>

          <h1 className="mt-2 text-3xl font-bold">
            Connected Devices
          </h1>

          <p className="mt-3 max-w-2xl text-slate-500">
            Connect your health and wearable ecosystem to Hybrid Human.
          </p>

        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm leading-6 text-slate-300">
            {message}
          </div>
        )}

        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">

          <ComingSoonCard
            name="Garmin"
            description="Garmin Connect workout and health data integration."
            icon={
              <Watch
                size={28}
              />
            }
          />

          <ComingSoonCard
            name="Apple Health"
            description="Apple Watch and iPhone health data integration through HealthKit."
            icon={
              <Smartphone
                size={28}
              />
            }
          />

          <ComingSoonCard
            name="Samsung Health"
            description="Samsung Health activity and health metrics integration."
            icon={
              <HeartPulse
                size={28}
              />
            }
          />

          <div className="rounded-3xl border border-emerald-500/20 bg-emerald-500/[0.04] p-6">

            <div className="flex items-start justify-between gap-4">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">

                <Activity
                  size={28}
                />

              </div>

              <StatusBadge
                status={
                  googleFitStatus
                }
              />

            </div>

            <h2 className="mt-6 text-xl font-semibold">
              Google Fit
            </h2>

            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">
              Sync steps, distance, workouts, heart rate and activity data into Hybrid Human.
            </p>

            <button
              type="button"
              onClick={
                openGoogleFit
              }
              className={
                googleFitStatus ===
                "connected"
                  ? "mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
                  : "mt-6 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
              }
            >

              {googleFitStatus ===
              "connected"
                ? "Manage Google Fit"
                : "Connect Google Fit"}

            </button>

          </div>

        </div>

        <section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.025] p-6">

          <div className="flex items-start gap-4">

            <RefreshCw
              className="mt-1 shrink-0 text-emerald-400"
              size={22}
            />

            <div>

              <h2 className="font-semibold">
                Automatic health sync
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Google Fit is currently the active Hybrid Human health integration. Once connected, your activity data is automatically synchronized when you sign in or refresh the dashboard.
              </p>

              <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
                Garmin, Apple Health and Samsung Health support will be added in future releases.
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}

function ComingSoonCard({
  name,
  description,
  icon,
}: {
  name: string;
  description: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

      <div className="flex items-start justify-between gap-4">

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/[0.04] text-slate-500">
          {icon}
        </div>

        <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-500">

          <Clock3
            size={13}
          />

          Coming Soon

        </div>

      </div>

      <h2 className="mt-6 text-xl font-semibold">
        {name}
      </h2>

      <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <button
        type="button"
        disabled
        className="mt-6 w-full cursor-not-allowed rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm font-semibold text-slate-600"
      >
        Coming Soon
      </button>

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status:
    | "not_connected"
    | "pending"
    | "connected"
    | "error";
}) {
  if (
    status ===
    "connected"
  ) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">

        <CheckCircle2
          size={14}
        />

        Connected

      </div>
    );
  }

  if (
    status ===
    "pending"
  ) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">

        <Clock3
          size={14}
        />

        Pending

      </div>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <div className="rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-400">
        Error
      </div>
    );
  }

  return (
    <div className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-xs font-semibold text-slate-500">
      Not connected
    </div>
  );
}