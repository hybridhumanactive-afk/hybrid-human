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
  ArrowLeft,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from "lucide-react";

import {
  auth,
  db,
} from "@/lib/firebase";

type ConnectionStatus =
  | "loading"
  | "not_connected"
  | "connecting"
  | "connected"
  | "syncing"
  | "error";

export default function GoogleFitPage() {
  const router =
    useRouter();

  const [
    status,
    setStatus,
  ] =
    useState<ConnectionStatus>(
      "loading"
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  const [
    steps,
    setSteps,
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

          const params =
            new URLSearchParams(
              window.location.search
            );

          const oauth =
            params.get(
              "oauth"
            );

          const error =
            params.get(
              "error"
            );

          if (error) {
            setStatus(
              "error"
            );

            if (
              error ===
              "access_denied"
            ) {
              setMessage(
                "Google Fit permission was denied."
              );

              return;
            }

            if (
              error ===
              "invalid_state"
            ) {
              setMessage(
                "Google Fit authorization could not be verified. Please try again."
              );

              return;
            }

            if (
              error ===
              "missing_user"
            ) {
              setMessage(
                "Your Hybrid Human account could not be identified. Please sign in again."
              );

              return;
            }

            if (
              error ===
              "token_exchange_failed"
            ) {
              setMessage(
                "Google authorization succeeded, but Hybrid Human could not complete the token exchange."
              );

              return;
            }

            if (
              error ===
              "missing_server_credentials"
            ) {
              setMessage(
                "Google Fit server credentials are missing."
              );

              return;
            }

            setMessage(
              `Google Fit authorization failed: ${error}`
            );

            return;
          }

          try {
            const connectionRef =
              doc(
                db,
                "users",
                user.uid,
                "deviceConnections",
                "google_fit"
              );

            const connectionSnap =
              await getDoc(
                connectionRef
              );

            if (
              connectionSnap.exists() &&
              connectionSnap.data()
                .status ===
                "connected"
            ) {
              setStatus(
                "connected"
              );

              if (
                oauth ===
                "success"
              ) {
                setMessage(
                  "Google Fit connected successfully to your Hybrid Human account."
                );
              } else {
                setMessage(
                  "Google Fit is connected to your Hybrid Human account."
                );
              }

              await loadStoredSteps(
                user.uid
              );
            } else {
              setStatus(
                "not_connected"
              );
            }
          } catch (error) {
            console.error(
              "Google Fit status error:",
              error
            );

            setStatus(
              "error"
            );

            setMessage(
              "Could not check your Google Fit connection."
            );
          }
        }
      );

    return () => {
      unsubscribe();
    };
  }, [router]);

  async function loadStoredSteps(
    uid: string
  ) {
    try {
      const now =
        new Date();

      const dateId =
        now
          .toISOString()
          .slice(
            0,
            10
          );

      const healthRef =
        doc(
          db,
          "users",
          uid,
          "googleFitDaily",
          dateId
        );

      const healthSnap =
        await getDoc(
          healthRef
        );

      if (
        healthSnap.exists()
      ) {
        const storedSteps =
          healthSnap.data()
            .steps;

        if (
          typeof storedSteps ===
          "number"
        ) {
          setSteps(
            storedSteps
          );
        }
      }
    } catch (error) {
      console.error(
        "Could not load stored Google Fit steps:",
        error
      );
    }
  }

  async function connectGoogleFit() {
    const user =
      auth.currentUser;

    if (!user) {
      router.push(
        "/login"
      );

      return;
    }

    setStatus(
      "connecting"
    );

    setMessage(
      "Opening Google authorization..."
    );

    try {
      const idToken =
        await user.getIdToken(
          true
        );

      const response =
        await fetch(
          "/api/google-fit/connect",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${idToken}`,
            },
          }
        );

      const responseText =
        await response.text();

      let data: {
        authorizationUrl?: string;
        error?: string;
      } = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          throw new Error(
            `Google Fit server returned an invalid response. HTTP ${response.status}.`
          );
        }
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Google Fit server failed. HTTP ${response.status}.`
        );
      }

      if (
        !data.authorizationUrl
      ) {
        throw new Error(
          "Google Fit authorization URL was not returned."
        );
      }

      window.location.assign(
        data.authorizationUrl
      );
    } catch (error) {
      console.error(
        "Google Fit connection error:",
        error
      );

      setStatus(
        "error"
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not connect Google Fit."
      );
    }
  }

  async function syncGoogleFit() {
    const user =
      auth.currentUser;

    if (!user) {
      router.push(
        "/login"
      );

      return;
    }

    setStatus(
      "syncing"
    );

    setMessage(
      "Syncing Google Fit data..."
    );

    try {
      const idToken =
        await user.getIdToken(
          true
        );

      const response =
        await fetch(
          "/api/google-fit/sync",
          {
            method:
              "POST",

            headers: {
              Authorization:
                `Bearer ${idToken}`,

              "Content-Type":
                "application/json",
            },
          }
        );

      const responseText =
        await response.text();

      let data: {
        success?: boolean;
        steps?: number;
        date?: string;
        error?: string;
      } = {};

      if (responseText) {
        try {
          data =
            JSON.parse(
              responseText
            );
        } catch {
          throw new Error(
            `Google Fit sync returned an invalid response. HTTP ${response.status}.`
          );
        }
      }

      if (
        !response.ok ||
        !data.success
      ) {
        throw new Error(
          data.error ||
            "Google Fit sync failed."
        );
      }

      if (
        typeof data.steps ===
        "number"
      ) {
        setSteps(
          data.steps
        );
      }

      setStatus(
        "connected"
      );

      setMessage(
        `Google Fit synced successfully. Today's steps: ${(
          data.steps ?? 0
        ).toLocaleString()}.`
      );
    } catch (error) {
      console.error(
        "Google Fit sync error:",
        error
      );

      setStatus(
        "error"
      );

      setMessage(
        error instanceof Error
          ? error.message
          : "Could not sync Google Fit data."
      );
    }
  }

  if (
    status ===
    "loading"
  ) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#06100c] text-slate-400">

        <Loader2
          className="mr-3 animate-spin"
          size={22}
        />

        Loading Google Fit...

      </main>
    );
  }

  const isConnected =
    status ===
      "connected" ||
    status ===
      "syncing";

  return (
    <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">

      <div className="mx-auto max-w-4xl">

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

        <section className="rounded-3xl border border-white/10 bg-white/[0.025] p-8">

          <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">

            <div>

              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Integration
              </p>

              <h1 className="mt-2 text-3xl font-bold">
                Google Fit
              </h1>

              <p className="mt-3 max-w-xl text-slate-500">
                Connect and sync your
                Google Fit account with
                Hybrid Human.
              </p>

            </div>

            <StatusBadge
              status={
                status
              }
            />

          </div>

          <div className="mt-8 rounded-2xl border border-white/10 bg-black/10 p-6">

            <h2 className="font-semibold">
              Requested permissions
            </h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Hybrid Human requests
              read-only access to your
              Google Fit data.
            </p>

            <div className="mt-5 grid gap-3 sm:grid-cols-2">

              <PermissionItem
                text="Physical activity"
              />

              <PermissionItem
                text="Steps"
              />

              <PermissionItem
                text="Distance"
              />

              <PermissionItem
                text="Heart rate"
              />

              <PermissionItem
                text="Body measurements"
              />

              <PermissionItem
                text="Sleep"
              />

            </div>

          </div>

          {isConnected && (
            <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-6">

              <p className="text-sm text-slate-400">
                Today's Google Fit steps
              </p>

              <p className="mt-2 text-4xl font-bold text-emerald-400">
                {steps === null
                  ? "--"
                  : steps.toLocaleString()}
              </p>

            </div>
          )}

          {message && (
            <div
              className={
                status ===
                "error"
                  ? "mt-6 rounded-2xl border border-red-500/20 bg-red-500/5 p-5 text-sm text-red-300"
                  : "mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 text-sm text-slate-300"
              }
            >
              {message}
            </div>
          )}

          <div className="mt-8">

            {isConnected ? (
              <div className="space-y-4">

                <button
                  type="button"
                  onClick={
                    syncGoogleFit
                  }
                  disabled={
                    status ===
                    "syncing"
                  }
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
                >

                  {status ===
                  "syncing" ? (
                    <>
                      <Loader2
                        className="mr-2 animate-spin"
                        size={18}
                      />

                      Syncing Google Fit...
                    </>
                  ) : (
                    <>
                      <RefreshCw
                        className="mr-2"
                        size={18}
                      />

                      Sync Google Fit Data
                    </>
                  )}

                </button>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/devices"
                    )
                  }
                  className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-5 py-3 font-semibold text-slate-300 transition hover:bg-white/[0.06]"
                >
                  Return to Devices
                </button>

                <button
                  type="button"
                  onClick={
                    connectGoogleFit
                  }
                  className="w-full rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-400 transition hover:bg-emerald-500/20"
                >
                  Re-authorize Google Fit
                </button>

              </div>
            ) : (
              <button
                type="button"
                onClick={
                  connectGoogleFit
                }
                disabled={
                  status ===
                  "connecting"
                }
                className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400 disabled:opacity-60"
              >

                {status ===
                "connecting" ? (
                  <>
                    <Loader2
                      className="mr-2 animate-spin"
                      size={18}
                    />

                    Opening Google...
                  </>
                ) : (
                  "Connect Google Fit"
                )}

              </button>
            )}

          </div>

        </section>

      </div>

    </main>
  );
}

function PermissionItem({
  text,
}: {
  text: string;
}) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/[0.025] px-4 py-3 text-sm text-slate-300">

      <CheckCircle2
        size={16}
        className="text-emerald-400"
      />

      {text}

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status:
    ConnectionStatus;
}) {
  if (
    status ===
      "connected" ||
    status ===
      "syncing"
  ) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">

        <CheckCircle2
          size={15}
        />

        Connected

      </div>
    );
  }

  if (
    status ===
    "connecting"
  ) {
    return (
      <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400">
        Connecting
      </div>
    );
  }

  if (
    status ===
    "error"
  ) {
    return (
      <div className="rounded-full border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-400">
        Error
      </div>
    );
  }

  return (
    <div className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-slate-500">
      Not connected
    </div>
  );
}