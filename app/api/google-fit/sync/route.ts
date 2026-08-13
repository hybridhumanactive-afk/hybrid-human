import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebase-admin";

type GoogleConnection = {
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: number;
};

type GoogleTokenResponse = {
  access_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
};

type FitValue = {
  intVal?: number;
  fpVal?: number;
};

type FitPoint = {
  value?: FitValue[];
};

type FitDataset = {
  dataSourceId?: string;
  point?: FitPoint[];
};

type FitBucket = {
  dataset?: FitDataset[];
};

type AggregateResponse = {
  bucket?: FitBucket[];
};

async function refreshAccessToken(
  refreshToken: string
) {
  const clientId =
    process.env.GOOGLE_FIT_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_FIT_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    throw new Error(
      "Google Fit server credentials are missing."
    );
  }

  const response =
    await fetch(
      "https://oauth2.googleapis.com/token",
      {
        method: "POST",

        headers: {
          "Content-Type":
            "application/x-www-form-urlencoded",
        },

        body:
          new URLSearchParams({
            client_id:
              clientId,

            client_secret:
              clientSecret,

            refresh_token:
              refreshToken,

            grant_type:
              "refresh_token",
          }),

        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as GoogleTokenResponse;

  if (
    !response.ok ||
    !data.access_token
  ) {
    console.error(
      "Google token refresh failed:",
      data
    );

    throw new Error(
      "Could not refresh Google Fit access token."
    );
  }

  return {
    accessToken:
      data.access_token,

    expiresIn:
      data.expires_in ?? 3600,
  };
}

async function getValidAccessToken(
  uid: string
) {
  const connectionRef =
    adminDb
      .collection(
        "googleFitConnections"
      )
      .doc(
        uid
      );

  const connectionSnap =
    await connectionRef.get();

  if (!connectionSnap.exists) {
    throw new Error(
      "Google Fit is not connected."
    );
  }

  const connection =
    connectionSnap.data() as GoogleConnection;

  const now =
    Date.now();

  const expiresAt =
    connection.expiresAt ?? 0;

  if (
    connection.accessToken &&
    expiresAt >
      now + 60_000
  ) {
    return connection.accessToken;
  }

  if (!connection.refreshToken) {
    throw new Error(
      "Google Fit authorization has expired. Please reconnect Google Fit."
    );
  }

  const refreshed =
    await refreshAccessToken(
      connection.refreshToken
    );

  const newExpiresAt =
    Date.now() +
    refreshed.expiresIn * 1000;

  await connectionRef.set(
    {
      accessToken:
        refreshed.accessToken,

      expiresIn:
        refreshed.expiresIn,

      expiresAt:
        newExpiresAt,

      updatedAt:
        FieldValue.serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  return refreshed.accessToken;
}

async function getTodayGoogleFitData(
  accessToken: string
) {
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
        method: "POST",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,

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
                  "com.google.heart_rate.summary",
              },
            ],

            bucketByTime: {
              durationMillis:
                now.getTime() -
                start.getTime(),
            },

            startTimeMillis:
              start.getTime(),

            endTimeMillis:
              now.getTime(),
          }),

        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as AggregateResponse;

  if (!response.ok) {
    console.error(
      "Google Fit aggregate error:",
      data
    );

    throw new Error(
      "Could not read Google Fit data."
    );
  }

  let steps =
    0;

  let distanceMeters =
    0;

  let heartRateAverage:
    number | null =
    null;

  let heartRateMin:
    number | null =
    null;

  let heartRateMax:
    number | null =
    null;

  const buckets =
    Array.isArray(
      data.bucket
    )
      ? data.bucket
      : [];

  for (
    const bucket
    of buckets
  ) {
    const datasets =
      Array.isArray(
        bucket.dataset
      )
        ? bucket.dataset
        : [];

    for (
      const dataset
      of datasets
    ) {
      const sourceId =
        dataset.dataSourceId ??
        "";

      const points =
        Array.isArray(
          dataset.point
        )
          ? dataset.point
          : [];

      if (
        sourceId.includes(
          "step_count"
        )
      ) {
        for (
          const point
          of points
        ) {
          const values =
            point.value ?? [];

          for (
            const value
            of values
          ) {
            if (
              typeof value.intVal ===
              "number"
            ) {
              steps +=
                value.intVal;
            }
          }
        }
      }

      if (
        sourceId.includes(
          "distance"
        )
      ) {
        for (
          const point
          of points
        ) {
          const values =
            point.value ?? [];

          for (
            const value
            of values
          ) {
            if (
              typeof value.fpVal ===
              "number"
            ) {
              distanceMeters +=
                value.fpVal;
            }
          }
        }
      }

      if (
        sourceId.includes(
          "heart_rate"
        )
      ) {
        for (
          const point
          of points
        ) {
          const values =
            point.value ?? [];

          if (
            values.length >= 3
          ) {
            const average =
              values[0]
                ?.fpVal;

            const max =
              values[1]
                ?.fpVal;

            const min =
              values[2]
                ?.fpVal;

            if (
              typeof average ===
              "number"
            ) {
              heartRateAverage =
                average;
            }

            if (
              typeof max ===
              "number"
            ) {
              heartRateMax =
                max;
            }

            if (
              typeof min ===
              "number"
            ) {
              heartRateMin =
                min;
            }
          }
        }
      }
    }
  }

  return {
    steps,

    distanceMeters,

    distanceKm:
      distanceMeters /
      1000,

    heartRateAverage,

    heartRateMin,

    heartRateMax,
  };
}

export async function POST(
  request: NextRequest
) {
  try {
    const authorization =
      request.headers.get(
        "authorization"
      );

    if (
      !authorization ||
      !authorization.startsWith(
        "Bearer "
      )
    ) {
      return NextResponse.json(
        {
          error:
            "Authentication required.",
        },
        {
          status: 401,
        }
      );
    }

    const firebaseToken =
      authorization.substring(
        7
      );

    const decodedToken =
      await adminAuth.verifyIdToken(
        firebaseToken
      );

    const uid =
      decodedToken.uid;

    const accessToken =
      await getValidAccessToken(
        uid
      );

    const fitData =
      await getTodayGoogleFitData(
        accessToken
      );

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
      adminDb
        .collection(
          "users"
        )
        .doc(
          uid
        )
        .collection(
          "googleFitDaily"
        )
        .doc(
          dateId
        );

    await healthRef.set(
      {
        uid,

        date:
          dateId,

        provider:
          "google_fit",

        steps:
          fitData.steps,

        distanceMeters:
          fitData.distanceMeters,

        distanceKm:
          fitData.distanceKm,

        heartRateAverage:
          fitData.heartRateAverage,

        heartRateMin:
          fitData.heartRateMin,

        heartRateMax:
          fitData.heartRateMax,

        syncedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    await adminDb
      .collection(
        "googleFitConnections"
      )
      .doc(
        uid
      )
      .set(
        {
          lastSyncAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge: true,
        }
      );

    return NextResponse.json({
      success:
        true,

      date:
        dateId,

      steps:
        fitData.steps,

      distanceMeters:
        fitData.distanceMeters,

      distanceKm:
        fitData.distanceKm,

      heartRateAverage:
        fitData.heartRateAverage,

      heartRateMin:
        fitData.heartRateMin,

      heartRateMax:
        fitData.heartRateMax,
    });
  } catch (error) {
    console.error(
      "Google Fit sync error:",
      error
    );

    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Google Fit sync failed.",
      },
      {
        status: 500,
      }
    );
  }
}