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
} from "@/lib/firebase";

import {
  connectSamsungHealth,
  disconnectSamsungHealth,
  getDeviceConnection,
  setDeviceConnectionStatus,
} from "@/lib/device-connections";

import type {
  DeviceConnection,
  DeviceProvider,
} from "@/lib/integrations";

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
    garminConnection,
    setGarminConnection,
  ] =
    useState<DeviceConnection | null>(
      null
    );

  const [
    appleConnection,
    setAppleConnection,
  ] =
    useState<DeviceConnection | null>(
      null
    );

  const [
    samsungConnection,
    setSamsungConnection,
  ] =
    useState<DeviceConnection | null>(
      null
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  async function loadConnections(
    userId: string
  ) {
    const [
      garmin,
      apple,
      samsung,
    ] =
      await Promise.all([
        getDeviceConnection(
          userId,
          "garmin"
        ),

        getDeviceConnection(
          userId,
          "apple"
        ),

        getDeviceConnection(
          userId,
          "samsung"
        ),
      ]);

    setGarminConnection(
      garmin
    );

    setAppleConnection(
      apple
    );

    setSamsungConnection(
      samsung
    );
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
            await loadConnections(
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
      await loadConnections(
        user.uid
      );
    } catch (error) {
      console.error(
        "Refresh error:",
        error
      );

      setMessage(
        "Could not refresh your device connections."
      );
    } finally {
      setRefreshing(
        false
      );
    }
  }

  async function markPending(
    provider: DeviceProvider
  ) {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    try {
      await setDeviceConnectionStatus(
        user.uid,
        provider,
        "pending"
      );

      const connection:
        DeviceConnection =
        {
          provider,
          status:
            "pending",
        };

      if (
        provider ===
        "garmin"
      ) {
        setGarminConnection(
          connection
        );

        setMessage(
          "Garmin integration is waiting for developer credentials."
        );
      }

      if (
        provider ===
        "apple"
      ) {
        setAppleConnection(
          connection
        );

        setMessage(
          "Apple Health integration is waiting for the HealthKit connection."
        );
      }
    } catch (error) {
      console.error(
        "Integration update error:",
        error
      );

      setMessage(
        "Could not update the integration."
      );
    }
  }

  async function handleSamsungConnect() {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    setMessage(
      ""
    );

    try {
      await connectSamsungHealth(
        user.uid
      );

      setSamsungConnection({
        provider:
          "samsung",

        status:
          "pending",
      });

      setMessage(
        "Samsung Health connection requested. Open Samsung Health on your linked phone and allow Hybrid Human access, then refresh this page."
      );
    } catch (error) {
      console.error(
        "Samsung connection error:",
        error
      );

      setMessage(
        "Could not start the Samsung Health connection."
      );
    }
  }

  async function handleSamsungDisconnect() {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    try {
      await disconnectSamsungHealth(
        user.uid
      );

      setSamsungConnection({
        provider:
          "samsung",

        status:
          "not_connected",
      });

      setMessage(
        "Samsung Health has been disconnected from Hybrid Human."
      );
    } catch (error) {
      console.error(
        "Samsung disconnect error:",
        error
      );

      setMessage(
        "Could not disconnect Samsung Health."
      );
    }
  }

  if (loading) {
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

  const samsungStatus =
    samsungConnection
      ?.status ??
    "not_connected";

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-6xl">

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
            Connect your health and wearable
            ecosystem to Hybrid Human.
          </p>

        </header>

        {message && (
          <div className="mb-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm leading-6 text-slate-300">
            {message}
          </div>
        )}

        <div className="grid gap-5 lg:grid-cols-3">

          <StandardDeviceCard
            name="Garmin"
            description="Import Garmin Connect workouts and health metrics."
            icon={
              <Watch
                size={28}
              />
            }
            connection={
              garminConnection
            }
            buttonLabel="Prepare Garmin"
            onClick={() =>
              markPending(
                "garmin"
              )
            }
          />

          <StandardDeviceCard
            name="Apple Health"
            description="Import Apple Watch and iPhone health data through HealthKit."
            icon={
              <Smartphone
                size={28}
              />
            }
            connection={
              appleConnection
            }
            buttonLabel="Prepare Apple"
            onClick={() =>
              markPending(
                "apple"
              )
            }
          />

          <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

            <div className="flex items-start justify-between gap-4">

              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">

                <HeartPulse
                  size={28}
                />

              </div>

              <StatusBadge
                status={
                  samsungStatus
                }
              />

            </div>

            <h2 className="mt-6 text-xl font-semibold">
              Samsung Health
            </h2>

            <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">
              Connect Samsung Health to import
              workouts and health metrics into
              Hybrid Human.
            </p>

            {samsungStatus ===
            "connected" ? (
              <div className="mt-6 space-y-3">

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/integrations/samsung"
                    )
                  }
                  className="w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
                >
                  View Samsung Health
                </button>

                <button
                  type="button"
                  onClick={
                    handleSamsungDisconnect
                  }
                  className="w-full rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
                >
                  Disconnect
                </button>

              </div>
            ) : samsungStatus ===
              "pending" ? (
              <div className="mt-6 space-y-3">

                <button
                  type="button"
                  onClick={
                    refreshConnections
                  }
                  className="w-full rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-semibold text-amber-400 transition hover:bg-amber-500/20"
                >
                  Check Connection
                </button>

                <p className="text-center text-xs text-slate-600">
                  Waiting for Samsung Health authorization
                </p>

              </div>
            ) : (
              <button
                type="button"
                onClick={
                  handleSamsungConnect
                }
                className="mt-6 w-full rounded-xl bg-emerald-500 px-4 py-3 text-sm font-bold text-black transition hover:bg-emerald-400"
              >
                Connect Samsung Health
              </button>
            )}

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
                Samsung Health connection
              </h2>

              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                Once Samsung Health has authorized
                Hybrid Human, the connection status
                will update automatically and synced
                health data becomes available to your
                Hybrid Human account.
              </p>

            </div>

          </div>

        </section>

      </div>

    </main>
  );
}

function StandardDeviceCard({
  name,
  description,
  icon,
  connection,
  buttonLabel,
  onClick,
}: {
  name: string;

  description: string;

  icon:
    React.ReactNode;

  connection:
    | DeviceConnection
    | null;

  buttonLabel: string;

  onClick: () => void;
}) {
  const status =
    connection?.status ??
    "not_connected";

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-6">

      <div className="flex items-start justify-between gap-4">

        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-400">
          {icon}
        </div>

        <StatusBadge
          status={
            status
          }
        />

      </div>

      <h2 className="mt-6 text-xl font-semibold">
        {name}
      </h2>

      <p className="mt-2 min-h-16 text-sm leading-6 text-slate-500">
        {description}
      </p>

      <button
        type="button"
        onClick={
          onClick
        }
        className="mt-6 w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
      >
        {status ===
        "pending"
          ? "Integration Pending"
          : buttonLabel}
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