"use client";

import { useEffect, useState } from "react";
import Script from "next/script";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  Activity,
  ArrowLeft,
  CheckCircle2,
  Flame,
  Footprints,
  HeartPulse,
  Loader2,
  RefreshCw,
  Route,
  Unplug,
} from "lucide-react";

import { auth, db } from "@/lib/firebase";

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
};

type ConnectionStatus =
  | "not_connected"
  | "connecting"
  | "connected"
  | "error";

type GoogleFitMetrics = {
  steps: number;
  distanceMeters: number;
  calories: number;
  averageHeartRate: number | null;
  maxHeartRate: number | null;
  workoutCount: number;
};

type GoogleFitValue = {
  intVal?: number;
  fpVal?: number;
};

type GoogleFitPoint = {
  dataTypeName?: string;
  value?: GoogleFitValue[];
};

type GoogleFitDataset = {
  point?: GoogleFitPoint[];
};

type GoogleFitBucket = {
  dataset?: GoogleFitDataset[];
};

type GoogleFitAggregateResponse = {
  bucket?: GoogleFitBucket[];
};

type GoogleFitSessionResponse = {
  session?: unknown[];
};

declare global {
  interface Window {
    google?: {
      accounts: {
        oauth2: {
          initTokenClient: (config: {
            client_id: string;
            scope: string;
            callback: (
              response: GoogleTokenResponse
            ) => void;
            error_callback?: (
              error: unknown
            ) => void;
          }) => {
            requestAccessToken: (
              options?: {
                prompt?: string;
              }
            ) => void;
          };

          revoke: (
            token: string,
            callback?: () => void
          ) => void;
        };
      };
    };
  }
}

const GOOGLE_FIT_SCOPES = [
  "https://www.googleapis.com/auth/fitness.activity.read",
  "https://www.googleapis.com/auth/fitness.body.read",
  "https://www.googleapis.com/auth/fitness.heart_rate.read",
  "https://www.googleapis.com/auth/fitness.location.read",
  "https://www.googleapis.com/auth/fitness.sleep.read",
].join(" ");

export default function GoogleFitPage() {
  const router = useRouter();

  const [loading, setLoading] =
    useState(true);

  const [googleLoaded, setGoogleLoaded] =
    useState(false);

  const [status, setStatus] =
    useState<ConnectionStatus>(
      "not_connected"
    );

  const [accessToken, setAccessToken] =
    useState("");

  const [syncing, setSyncing] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [metrics, setMetrics] =
    useState<GoogleFitMetrics | null>(
      null
    );

  const clientId =
    process.env
      .NEXT_PUBLIC_GOOGLE_FIT_CLIENT_ID;

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
            }

            const today =
              getTodayKey();

            const healthRef =
              doc(
                db,
                "users",
                user.uid,
                "googleFitDaily",
                today
              );

            const healthSnap =
              await getDoc(
                healthRef
              );

            if (
              healthSnap.exists()
            ) {
              const data =
                healthSnap.data();

              setMetrics({
                steps:
                  Number(
                    data.steps ?? 0
                  ),

                distanceMeters:
                  Number(
                    data.distanceMeters ??
                      0
                  ),

                calories:
                  Number(
                    data.calories ?? 0
                  ),

                averageHeartRate:
                  data.averageHeartRate ??
                  null,

                maxHeartRate:
                  data.maxHeartRate ??
                  null,

                workoutCount:
                  Number(
                    data.workoutCount ??
                      0
                  ),
              });
            }
          } catch (error) {
            console.error(
              "Google Fit load error:",
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

  async function saveConnection() {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    await setDoc(
      doc(
        db,
        "users",
        user.uid,
        "deviceConnections",
        "google_fit"
      ),
      {
        provider:
          "google_fit",

        status:
          "connected",

        connectedAt:
          serverTimestamp(),

        lastSyncAt:
          serverTimestamp(),

        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );
  }

  async function verifyGoogleFit(
    token: string
  ) {
    const response =
      await fetch(
        "https://www.googleapis.com/fitness/v1/users/me/dataSources",
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (!response.ok) {
      throw new Error(
        "Google Fit verification failed."
      );
    }
  }

  function connectGoogleFit() {
    setMessage("");

    if (!clientId) {
      setStatus(
        "error"
      );

      setMessage(
        "Google Fit Client ID is missing."
      );

      return;
    }

    if (
      !googleLoaded ||
      !window.google
    ) {
      setMessage(
        "Google authorization is still loading. Try again."
      );

      return;
    }

    setStatus(
      "connecting"
    );

    const tokenClient =
      window.google.accounts.oauth2
        .initTokenClient({
          client_id:
            clientId,

          scope:
            GOOGLE_FIT_SCOPES,

          callback:
            async (
              response
            ) => {
              if (
                response.error ||
                !response.access_token
              ) {
                setStatus(
                  "error"
                );

                setMessage(
                  "Google Fit authorization failed."
                );

                return;
              }

              try {
                await verifyGoogleFit(
                  response.access_token
                );

                setAccessToken(
                  response.access_token
                );

                await saveConnection();

                setStatus(
                  "connected"
                );

                setMessage(
                  "Google Fit connected. You can now sync your data."
                );
              } catch (error) {
                console.error(
                  error
                );

                setStatus(
                  "error"
                );

                setMessage(
                  "Google Fit access could not be verified."
                );
              }
            },

          error_callback:
            (error) => {
              console.error(
                "Google OAuth error:",
                error
              );

              setStatus(
                "error"
              );

              setMessage(
                "Google authorization failed."
              );
            },
        });

    tokenClient
      .requestAccessToken({
        prompt:
          "consent",
      });
  }

  async function getAggregateData(
    token: string
  ): Promise<GoogleFitAggregateResponse> {
    const now =
      new Date();

    const start =
      new Date();

    start.setHours(
      0,
      0,
      0,
      0
    );

    const response =
      await fetch(
        "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
        {
          method:
            "POST",

          headers: {
            Authorization:
              `Bearer ${token}`,

            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify({
              aggregateBy: [
                {
                  dataTypeName:
                    "com.google.step_count.delta",
                },
                {
                  dataTypeName:
                    "com.google.distance.delta",
                },
                {
                  dataTypeName:
                    "com.google.calories.expended",
                },
                {
                  dataTypeName:
                    "com.google.heart_rate.bpm",
                },
              ],

              bucketByTime: {
                durationMillis:
                  86400000,
              },

              startTimeMillis:
                start.getTime(),

              endTimeMillis:
                now.getTime(),
            }),
        }
      );

    if (!response.ok) {
      const errorText =
        await response.text();

      console.error(
        errorText
      );

      throw new Error(
        "Google Fit aggregate request failed."
      );
    }

    return response.json();
  }

  async function getWorkoutCount(
    token: string
  ) {
    const end =
      new Date();

    const start =
      new Date();

    start.setDate(
      start.getDate() - 30
    );

    const requestUrl =
      "https://www.googleapis.com/fitness/v1/users/me/sessions" +
      `?startTime=${encodeURIComponent(
        start.toISOString()
      )}` +
      `&endTime=${encodeURIComponent(
        end.toISOString()
      )}`;

    const response =
      await fetch(
        requestUrl,
        {
          headers: {
            Authorization:
              `Bearer ${token}`,
          },
        }
      );

    if (!response.ok) {
      console.error(
        await response.text()
      );

      return 0;
    }

    const data:
      GoogleFitSessionResponse =
      await response.json();

    return Array.isArray(
      data.session
    )
      ? data.session.length
      : 0;
  }

  async function syncGoogleFit() {
    if (!accessToken) {
      setMessage(
        "Click Re-authorize Google Fit first."
      );

      return;
    }

    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    setSyncing(
      true
    );

    setMessage(
      "Reading Google Fit data..."
    );

    try {
      const aggregateData =
        await getAggregateData(
          accessToken
        );

      const workoutCount =
        await getWorkoutCount(
          accessToken
        );

      const parsed =
        parseAggregateData(
          aggregateData
        );

      const result:
        GoogleFitMetrics =
        {
          ...parsed,
          workoutCount,
        };

      setMetrics(
        result
      );

      const today =
        getTodayKey();

      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "googleFitDaily",
          today
        ),
        {
          uid:
            user.uid,

          provider:
            "google_fit",

          source:
            "google_fit",

          date:
            today,

          steps:
            result.steps,

          distanceMeters:
            result.distanceMeters,

          distanceKm:
            Number(
              (
                result.distanceMeters /
                1000
              ).toFixed(2)
            ),

          calories:
            Number(
              result.calories.toFixed(
                2
              )
            ),

          averageHeartRate:
            result.averageHeartRate,

          maxHeartRate:
            result.maxHeartRate,

          workoutCount:
            result.workoutCount,

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      await setDoc(
        doc(
          db,
          "users",
          user.uid,
          "deviceConnections",
          "google_fit"
        ),
        {
          provider:
            "google_fit",

          status:
            "connected",

          lastSyncAt:
            serverTimestamp(),

          updatedAt:
            serverTimestamp(),
        },
        {
          merge: true,
        }
      );

      setMessage(
        "Google Fit data synced successfully."
      );
    } catch (error) {
      console.error(
        "Google Fit sync error:",
        error
      );

      setMessage(
        "Sync failed. Click Re-authorize Google Fit and try again."
      );
    } finally {
      setSyncing(
        false
      );
    }
  }

  async function disconnectGoogleFit() {
    const user =
      auth.currentUser;

    if (!user) {
      return;
    }

    if (
      accessToken &&
      window.google
    ) {
      window.google.accounts.oauth2
        .revoke(
          accessToken
        );
    }

    await setDoc(
      doc(
        db,
        "users",
        user.uid,
        "deviceConnections",
        "google_fit"
      ),
      {
        provider:
          "google_fit",

        status:
          "not_connected",

        updatedAt:
          serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    setAccessToken(
      ""
    );

    setMetrics(
      null
    );

    setStatus(
      "not_connected"
    );

    setMessage(
      "Google Fit disconnected."
    );
  }

  if (loading) {
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

  return (
    <>
      <Script
        src="https://accounts.google.com/gsi/client"
        strategy="afterInteractive"
        onLoad={() =>
          setGoogleLoaded(
            true
          )
        }
      />

      <main className="min-h-screen bg-[#06100c] px-5 py-8 text-white">
        <div className="mx-auto max-w-5xl">

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

                <p className="mt-3 text-slate-500">
                  Connect and sync your Google Fit data.
                </p>
              </div>

              <StatusBadge
                status={
                  status
                }
              />

            </div>

            {message && (
              <div className="mt-6 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-4 text-sm text-slate-300">
                {message}
              </div>
            )}

            {metrics && (
              <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">

                <MetricCard
                  title="Steps"
                  value={
                    metrics.steps.toLocaleString()
                  }
                  unit="steps"
                  icon={
                    <Footprints size={22} />
                  }
                />

                <MetricCard
                  title="Distance"
                  value={
                    (
                      metrics.distanceMeters /
                      1000
                    ).toFixed(2)
                  }
                  unit="km"
                  icon={
                    <Route size={22} />
                  }
                />

                <MetricCard
                  title="Calories"
                  value={
                    metrics.calories.toFixed(
                      0
                    )
                  }
                  unit="kcal"
                  icon={
                    <Flame size={22} />
                  }
                />

                <MetricCard
                  title="Average HR"
                  value={
                    metrics.averageHeartRate !==
                    null
                      ? metrics.averageHeartRate.toFixed(
                          0
                        )
                      : "--"
                  }
                  unit="bpm"
                  icon={
                    <HeartPulse size={22} />
                  }
                />

                <MetricCard
                  title="Maximum HR"
                  value={
                    metrics.maxHeartRate !==
                    null
                      ? metrics.maxHeartRate.toFixed(
                          0
                        )
                      : "--"
                  }
                  unit="bpm"
                  icon={
                    <HeartPulse size={22} />
                  }
                />

                <MetricCard
                  title="Workouts"
                  value={
                    String(
                      metrics.workoutCount
                    )
                  }
                  unit="last 30 days"
                  icon={
                    <Activity size={22} />
                  }
                />

              </div>
            )}

            <div className="mt-8 space-y-3">

              {status ===
              "not_connected" ||
              status ===
              "error" ? (
                <button
                  type="button"
                  onClick={
                    connectGoogleFit
                  }
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400"
                >
                  Connect Google Fit
                </button>
              ) : status ===
                "connecting" ? (
                <button
                  type="button"
                  disabled
                  className="flex w-full items-center justify-center rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black opacity-60"
                >
                  <Loader2
                    className="mr-2 animate-spin"
                    size={18}
                  />

                  Connecting...
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={
                      syncGoogleFit
                    }
                    disabled={
                      syncing
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black hover:bg-emerald-400 disabled:opacity-60"
                  >
                    {syncing ? (
                      <Loader2
                        className="animate-spin"
                        size={18}
                      />
                    ) : (
                      <RefreshCw
                        size={18}
                      />
                    )}

                    {syncing
                      ? "Syncing..."
                      : "Sync Google Fit Data"}
                  </button>

                  <button
                    type="button"
                    onClick={
                      connectGoogleFit
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-5 py-3 font-semibold text-emerald-400"
                  >
                    <RefreshCw
                      size={18}
                    />

                    Re-authorize Google Fit
                  </button>

                  <button
                    type="button"
                    onClick={
                      disconnectGoogleFit
                    }
                    className="flex w-full items-center justify-center gap-2 rounded-xl border border-red-500/20 bg-red-500/5 px-5 py-3 font-semibold text-red-400"
                  >
                    <Unplug
                      size={18}
                    />

                    Disconnect Google Fit
                  </button>
                </>
              )}

            </div>

          </section>

        </div>
      </main>
    </>
  );
}

function parseAggregateData(
  data: GoogleFitAggregateResponse
): Omit<
  GoogleFitMetrics,
  "workoutCount"
> {
  let steps = 0;
  let distanceMeters = 0;
  let calories = 0;

  let averageHeartRate:
    number | null = null;

  let maxHeartRate:
    number | null = null;

  const buckets =
    data.bucket ?? [];

  for (const bucket of buckets) {
    const datasets =
      bucket.dataset ?? [];

    for (const dataset of datasets) {
      const points =
        dataset.point ?? [];

      for (const point of points) {
        const type =
          point.dataTypeName ??
          "";

        const values =
          point.value ?? [];

        if (
          type.includes(
            "step_count"
          )
        ) {
          steps +=
            Number(
              values[0]?.intVal ??
                values[0]?.fpVal ??
                0
            );
        }

        if (
          type.includes(
            "distance"
          )
        ) {
          distanceMeters +=
            Number(
              values[0]?.fpVal ??
                values[0]?.intVal ??
                0
            );
        }

        if (
          type.includes(
            "calories"
          )
        ) {
          calories +=
            Number(
              values[0]?.fpVal ??
                values[0]?.intVal ??
                0
            );
        }

        if (
          type.includes(
            "heart_rate.summary"
          ) ||
          type.includes(
            "heart_rate"
          )
        ) {
          const average =
            Number(
              values[0]?.fpVal ??
                values[0]?.intVal ??
                0
            );

          const maximum =
            Number(
              values[1]?.fpVal ??
                values[1]?.intVal ??
                0
            );

          if (average > 0) {
            averageHeartRate =
              average;
          }

          if (maximum > 0) {
            maxHeartRate =
              maximum;
          }
        }
      }
    }
  }

  return {
    steps,
    distanceMeters,
    calories,
    averageHeartRate,
    maxHeartRate,
  };
}

function getTodayKey() {
  const now =
    new Date();

  return [
    now.getFullYear(),
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    ),
    String(
      now.getDate()
    ).padStart(
      2,
      "0"
    ),
  ].join("-");
}

function MetricCard({
  title,
  value,
  unit,
  icon,
}: {
  title: string;
  value: string;
  unit: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-5">

      <div className="text-emerald-400">
        {icon}
      </div>

      <p className="mt-4 text-sm text-slate-500">
        {title}
      </p>

      <div className="mt-2 flex items-end gap-2">

        <p className="text-3xl font-bold">
          {value}
        </p>

        <p className="mb-1 text-xs text-slate-500">
          {unit}
        </p>

      </div>

    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: ConnectionStatus;
}) {
  if (
    status === "connected"
  ) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">
        <CheckCircle2
          size={16}
        />

        Connected
      </div>
    );
  }

  if (
    status === "connecting"
  ) {
    return (
      <div className="rounded-full border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm font-semibold text-amber-400">
        Connecting
      </div>
    );
  }

  if (
    status === "error"
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