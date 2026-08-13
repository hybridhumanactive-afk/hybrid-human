"use client";

import {
  useEffect,
  useState,
} from "react";

import {
  useRouter,
} from "next/navigation";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
} from "lucide-react";

type ConnectionStatus =
  | "not_connected"
  | "connecting"
  | "authorized"
  | "error";

export default function GoogleFitPage() {
  const router =
    useRouter();

  const [
    status,
    setStatus,
  ] =
    useState<ConnectionStatus>(
      "not_connected"
    );

  const [
    message,
    setMessage,
  ] =
    useState("");

  useEffect(() => {
    const params =
      new URLSearchParams(
        window.location.search
      );

    const oauth =
      params.get("oauth");

    const error =
      params.get("error");

    if (
      oauth === "success"
    ) {
      setStatus(
        "authorized"
      );

      setMessage(
        "Google Fit authorization completed successfully."
      );

      return;
    }

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
        "token_exchange_failed"
      ) {
        setMessage(
          "Google authorization succeeded, but Hybrid Human could not exchange the authorization code."
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

      if (
        error ===
        "callback_failed"
      ) {
        setMessage(
          "Google Fit callback failed."
        );

        return;
      }

      setMessage(
        `Google Fit authorization failed: ${error}`
      );
    }
  }, []);

  function connectGoogleFit() {
    setStatus(
      "connecting"
    );

    setMessage(
      "Opening Google authorization..."
    );

    window.location.assign(
      "/api/google-fit/connect"
    );
  }

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
                Connect your Google Fit account
                to Hybrid Human.
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
              Hybrid Human will request read-only
              access to your Google Fit data.
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

            {status ===
            "authorized" ? (
              <div className="space-y-4">

                <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-5 text-emerald-300">

                  <CheckCircle2
                    size={22}
                  />

                  Google Fit authorization succeeded.

                </div>

                <button
                  type="button"
                  onClick={() =>
                    router.push(
                      "/devices"
                    )
                  }
                  className="w-full rounded-xl bg-emerald-500 px-5 py-3 font-bold text-black transition hover:bg-emerald-400"
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
                  Authorize Again
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
    "authorized"
  ) {
    return (
      <div className="flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm font-semibold text-emerald-400">

        <CheckCircle2
          size={15}
        />

        Authorized

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