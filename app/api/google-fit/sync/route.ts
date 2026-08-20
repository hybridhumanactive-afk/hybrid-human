import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  createHash,
} from "crypto";

import {
  adminAuth,
  adminDb,
} from "@/lib/firebase-admin";

import {
  scoreWorkout,
} from "@/lib/scoring";

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

type GoogleFitSession = {
  id?: string;
  name?: string;
  description?: string;
  startTimeMillis?: string;
  endTimeMillis?: string;
  activeTimeMillis?: string;
  modifiedTimeMillis?: string;
  activityType?: number;
};

type GoogleFitSessionResponse = {
  session?: GoogleFitSession[];
};

type UserProfile = {
  age?: number;
};

type SessionMetrics = {
  distanceMeters: number;
  distanceKm: number;
  heartRateAverage: number | null;
  heartRateMin: number | null;
  heartRateMax: number | null;
};

type ImportedWorkout = {
  workoutId: string;
  sessionId: string;
  type: string;
  date: string;
  durationMinutes: number;
  distanceKm: number;
  averageHeartRate: number;
  heartRatePercentage: number;
  basePoints: number;
  bonusPoints: number;
  points: number;
};

type ServerChallenge = {
  id: string;
  name: string;
  description: string;
  bonusPoints: number;
};

/*
  These are the same MVP challenge
  rules currently used by lib/challenges.ts.

  We duplicate the definitions here
  because this route runs with the
  Firebase Admin SDK on the server.
*/

const SERVER_CHALLENGES:
  ServerChallenge[] = [
    {
      id:
        "10k-finisher",

      name:
        "10K Finisher",

      description:
        "Complete a running workout of at least 10 km.",

      bonusPoints:
        20,
    },

    {
      id:
        "intensity-warrior",

      name:
        "Intensity Warrior",

      description:
        "Complete at least 60 minutes at 80% or more of your calculated maximum heart rate.",

      bonusPoints:
        20,
    },

    {
      id:
        "endurance-session",

      name:
        "Endurance Session",

      description:
        "Complete a workout lasting at least 90 minutes.",

      bonusPoints:
        10,
    },
  ];

function getDateKey(
  date:
    Date
) {
  const year =
    date.getFullYear();

  const month =
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const day =
    String(
      date.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${day}`;
}

function getWeekKey(
  date:
    Date
) {
  const current =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      date.getDate()
    );

  const day =
    current.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  const monday =
    new Date(
      current.getFullYear(),
      current.getMonth(),
      current.getDate() +
        difference
    );

  return getDateKey(
    monday
  );
}

function createWorkoutId(
  sessionId: string
) {
  const hash =
    createHash(
      "sha256"
    )
      .update(
        sessionId
      )
      .digest(
        "hex"
      )
      .slice(
        0,
        32
      );

  return `google-fit-${hash}`;
}

function getActivityName(
  activityType:
    number | undefined,
  sessionName:
    string | undefined
) {
  /*
    Google Fit activity constants:

    1  = Biking
    7  = Walking
    8  = Running
    35 = Hiking
    53 = Rowing
    54 = Rowing machine
    80 = Strength training
    82 = Swimming
    83 = Swimming pool
    84 = Open-water swimming
    88 = Treadmill
    93 = Fitness walking
    95 = Walking treadmill
    97 = Weightlifting
    108 = Other
    113 = CrossFit
    114 = HIIT
    115 = Interval training
  */

  switch (
    activityType
  ) {
    case 1:
    case 14:
    case 15:
    case 16:
    case 17:
    case 18:
    case 19:
      return "Cycling";

    case 7:
    case 93:
    case 94:
    case 95:
      return "Walking";

    case 8:
    case 56:
    case 57:
    case 58:
      return "Running";

    case 35:
      return "Hiking";

    case 53:
    case 54:
      return "Rowing";

    case 80:
    case 97:
    case 113:
    case 114:
    case 115:
      return "Gym";

    case 82:
    case 83:
    case 84:
      return "Swimming";

    case 88:
      return "Running";

    default:
      break;
  }

  const normalizedName =
    (
      sessionName ||
      ""
    ).toLowerCase();

  if (
    normalizedName.includes(
      "run"
    )
  ) {
    return "Running";
  }

  if (
    normalizedName.includes(
      "walk"
    )
  ) {
    return "Walking";
  }

  if (
    normalizedName.includes(
      "bike"
    ) ||
    normalizedName.includes(
      "cycling"
    )
  ) {
    return "Cycling";
  }

  if (
    normalizedName.includes(
      "swim"
    )
  ) {
    return "Swimming";
  }

  if (
    normalizedName.includes(
      "gym"
    ) ||
    normalizedName.includes(
      "strength"
    ) ||
    normalizedName.includes(
      "weight"
    )
  ) {
    return "Gym";
  }

  return "Other";
}

function isWorkoutActivity(
  activityType:
    number | undefined
) {
  /*
    Exclude activities that are not
    workouts for Hybrid Human.
  */

  const excluded =
    new Set([
      0,   // in vehicle
      3,   // still
      4,   // unknown
      5,   // tilting
      72,  // sleep
      117, // elevator
      118, // escalator
      122, // guided breathing
    ]);

  if (
    activityType ===
    undefined
  ) {
    return true;
  }

  return !excluded.has(
    activityType
  );
}

async function refreshAccessToken(
  refreshToken:
    string
) {
  const clientId =
    process.env
      .GOOGLE_FIT_CLIENT_ID;

  const clientSecret =
    process.env
      .GOOGLE_FIT_CLIENT_SECRET;

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
        method:
          "POST",

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

    if (
      data.error ===
        "invalid_grant"
    ) {
      throw new Error(
        "Google Fit connection expired. Please reconnect Google Fit."
      );
    }

    throw new Error(
      "Could not refresh Google Fit access token."
    );
  }

  return {
    accessToken:
      data.access_token,

    expiresIn:
      data.expires_in ??
      3600,
  };
}

async function getValidAccessToken(
  uid:
    string
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

  if (
    !connectionSnap.exists
  ) {
    throw new Error(
      "Google Fit is not connected."
    );
  }

  const connection =
    connectionSnap.data() as GoogleConnection;

  const now =
    Date.now();

  const expiresAt =
    connection.expiresAt ??
    0;

  if (
    connection.accessToken &&
    expiresAt >
      now + 60_000
  ) {
    return connection.accessToken;
  }

  if (
    !connection.refreshToken
  ) {
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
    refreshed.expiresIn *
      1000;

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
      merge:
        true,
    }
  );

  return refreshed.accessToken;
}

async function aggregateGoogleFitData(
  accessToken:
    string,
  startTimeMillis:
    number,
  endTimeMillis:
    number
) {
  const response =
    await fetch(
      "https://www.googleapis.com/fitness/v1/users/me/dataset:aggregate",
      {
        method:
          "POST",

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
                  "com.google.heart_rate.bpm",
              },
            ],

            bucketByTime: {
              durationMillis:
                Math.max(
                  1,
                  endTimeMillis -
                    startTimeMillis
                ),
            },

            startTimeMillis,

            endTimeMillis,
          }),

        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as AggregateResponse;

  if (
    !response.ok
  ) {
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
            point.value ??
            [];

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
            point.value ??
            [];

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
            point.value ??
            [];

          if (
            values.length >=
            3
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

async function getTodayGoogleFitData(
  accessToken:
    string
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

  return aggregateGoogleFitData(
    accessToken,
    start.getTime(),
    now.getTime()
  );
}

async function getGoogleFitSessions(
  accessToken:
    string
) {
  /*
    Look back seven days on every sync.

    Duplicate protection below means
    already imported workouts will not
    be created again.
  */

  const end =
    new Date();

  const start =
    new Date();

  start.setDate(
    start.getDate() -
      7
  );

  const params =
    new URLSearchParams({
      startTime:
        start.toISOString(),

      endTime:
        end.toISOString(),
    });

  const response =
    await fetch(
      `https://www.googleapis.com/fitness/v1/users/me/sessions?${params.toString()}`,
      {
        method:
          "GET",

        headers: {
          Authorization:
            `Bearer ${accessToken}`,
        },

        cache:
          "no-store",
      }
    );

  const data =
    (await response.json()) as GoogleFitSessionResponse;

  if (
    !response.ok
  ) {
    console.error(
      "Google Fit sessions error:",
      data
    );

    throw new Error(
      "Could not read Google Fit workouts."
    );
  }

  return Array.isArray(
    data.session
  )
    ? data.session
    : [];
}

async function evaluateServerChallenges({
  uid,
  workoutType,
  durationMinutes,
  distanceKm,
  heartRatePercentage,
  workoutDate,
}: {
  uid: string;
  workoutType: string;
  durationMinutes: number;
  distanceKm: number;
  heartRatePercentage: number;
  workoutDate: Date;
}) {
  const weekKey =
    getWeekKey(
      workoutDate
    );

  let totalBonusPoints =
    0;

  const completedChallenges:
    string[] = [];

  for (
    const challenge
    of SERVER_CHALLENGES
  ) {
    let passed =
      false;

    if (
      challenge.id ===
      "10k-finisher"
    ) {
      passed =
        workoutType ===
          "Running" &&
        distanceKm >=
          10;
    }

    if (
      challenge.id ===
      "intensity-warrior"
    ) {
      passed =
        durationMinutes >=
          60 &&
        heartRatePercentage >=
          80;
    }

    if (
      challenge.id ===
      "endurance-session"
    ) {
      passed =
        durationMinutes >=
        90;
    }

    if (
      !passed
    ) {
      continue;
    }

    const progressId =
      `${challenge.id}-${weekKey}`;

    const progressReference =
      adminDb
        .collection(
          "users"
        )
        .doc(
          uid
        )
        .collection(
          "challengeProgress"
        )
        .doc(
          progressId
        );

    const existingProgress =
      await progressReference.get();

    if (
      existingProgress.exists
    ) {
      continue;
    }

    await progressReference.set(
      {
        challengeId:
          challenge.id,

        challengeName:
          challenge.name,

        description:
          challenge.description,

        bonusPoints:
          challenge.bonusPoints,

        weekKey,

        completed:
          true,

        source:
          "google_fit",

        completedAt:
          FieldValue.serverTimestamp(),
      }
    );

    totalBonusPoints +=
      challenge.bonusPoints;

    completedChallenges.push(
      challenge.id
    );
  }

  return {
    totalBonusPoints,
    completedChallenges,
  };
}

async function importGoogleFitWorkouts(
  uid:
    string,
  age:
    number,
  accessToken:
    string
) {
  const sessions =
    await getGoogleFitSessions(
      accessToken
    );

  const imported:
    ImportedWorkout[] =
    [];

  let skippedExisting =
    0;

  for (
    const session
    of sessions
  ) {
    if (
      !isWorkoutActivity(
        session.activityType
      )
    ) {
      continue;
    }

    const sessionId =
      session.id ||
      `${session.startTimeMillis}-${session.endTimeMillis}-${session.activityType}`;

    const startTimeMillis =
      Number(
        session.startTimeMillis ||
        0
      );

    const endTimeMillis =
      Number(
        session.endTimeMillis ||
        0
      );

    if (
      !startTimeMillis ||
      !endTimeMillis ||
      endTimeMillis <=
        startTimeMillis
    ) {
      continue;
    }

    const activeTimeMillis =
      Number(
        session.activeTimeMillis ||
        0
      );

    const durationMillis =
      activeTimeMillis >
      0
        ? activeTimeMillis
        : endTimeMillis -
          startTimeMillis;

    const durationMinutes =
      Math.max(
        1,
        Math.round(
          durationMillis /
            60_000
        )
      );

    /*
      Ignore extremely short sessions.

      This stops small incidental
      activity sessions from appearing
      as workouts.
    */

    if (
      durationMinutes <
      5
    ) {
      continue;
    }

    const workoutId =
      createWorkoutId(
        sessionId
      );

    const workoutReference =
      adminDb
        .collection(
          "users"
        )
        .doc(
          uid
        )
        .collection(
          "workouts"
        )
        .doc(
          workoutId
        );

    const existingWorkout =
      await workoutReference.get();

    if (
      existingWorkout.exists
    ) {
      skippedExisting +=
        1;

      continue;
    }

    const metrics =
      (await aggregateGoogleFitData(
        accessToken,
        startTimeMillis,
        endTimeMillis
      )) as SessionMetrics & {
        steps?: number;
      };

    const workoutType =
      getActivityName(
        session.activityType,
        session.name
      );

    const averageHeartRate =
      metrics.heartRateAverage ??
      0;

    const score =
      scoreWorkout({
        age,

        averageHeartRate,

        durationMinutes,
      });

    const workoutDate =
      new Date(
        startTimeMillis
      );

    const challengeResult =
      await evaluateServerChallenges({
        uid,

        workoutType,

        durationMinutes,

        distanceKm:
          metrics.distanceKm,

        heartRatePercentage:
          score.heartRatePercentage,

        workoutDate,
      });

    const totalPoints =
      score.points +
      challengeResult.totalBonusPoints;

    const date =
      getDateKey(
        workoutDate
      );

    await workoutReference.set(
      {
        uid,

        date,

        type:
          workoutType,

        googleFitSessionId:
          sessionId,

        googleFitActivityType:
          session.activityType ??
          null,

        googleFitSessionName:
          session.name ??
          "",

        startTimeMillis,

        endTimeMillis,

        durationMinutes,

        distanceKm:
          metrics.distanceKm,

        distanceMeters:
          metrics.distanceMeters,

        averageHeartRate,

        heartRateMin:
          metrics.heartRateMin,

        heartRateMax:
          metrics.heartRateMax,

        maxHeartRate:
          score.maxHeartRate,

        heartRatePercentage:
          score.heartRatePercentage,

        heartRateZone:
          score.heartRateZone,

        basePoints:
          score.points,

        bonusPoints:
          challengeResult.totalBonusPoints,

        points:
          totalPoints,

        completedChallenges:
          challengeResult.completedChallenges,

        source:
          "google_fit",

        createdAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      }
    );

    imported.push({
      workoutId,

      sessionId,

      type:
        workoutType,

      date,

      durationMinutes,

      distanceKm:
        metrics.distanceKm,

      averageHeartRate,

      heartRatePercentage:
        score.heartRatePercentage,

      basePoints:
        score.points,

      bonusPoints:
        challengeResult.totalBonusPoints,

      points:
        totalPoints,
    });
  }

  return {
    foundSessions:
      sessions.length,

    importedCount:
      imported.length,

    skippedExisting,

    imported,
  };
}

export async function POST(
  request:
    NextRequest
) {
  try {
    /*
      ------------------------------------------------
      VERIFY FIREBASE USER
      ------------------------------------------------
    */

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
          status:
            401,
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

    /*
      ------------------------------------------------
      LOAD USER AGE
      ------------------------------------------------
    */

    const userReference =
      adminDb
        .collection(
          "users"
        )
        .doc(
          uid
        );

    const userSnapshot =
      await userReference.get();

    if (
      !userSnapshot.exists
    ) {
      throw new Error(
        "User profile does not exist."
      );
    }

    const profile =
      userSnapshot.data() as UserProfile;

    const age =
      Number(
        profile.age ||
        0
      );

    if (
      !Number.isFinite(
        age
      ) ||
      age <=
        0
    ) {
      throw new Error(
        "Your profile age is required for workout scoring."
      );
    }

    /*
      ------------------------------------------------
      GET GOOGLE ACCESS TOKEN
      ------------------------------------------------
    */

    const accessToken =
      await getValidAccessToken(
        uid
      );

    /*
      ------------------------------------------------
      DAILY GOOGLE FIT DATA
      ------------------------------------------------
    */

    const fitData =
      await getTodayGoogleFitData(
        accessToken
      );

    const now =
      new Date();

    const dateId =
      getDateKey(
        now
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
        merge:
          true,
      }
    );

    /*
      ------------------------------------------------
      IMPORT GOOGLE FIT WORKOUTS
      ------------------------------------------------
    */

    let workoutSync = {
      foundSessions:
        0,

      importedCount:
        0,

      skippedExisting:
        0,

      imported:
        [] as ImportedWorkout[],
    };

    try {
      workoutSync =
        await importGoogleFitWorkouts(
          uid,
          age,
          accessToken
        );
    } catch (
      workoutError
    ) {
      /*
        Do not fail today's steps sync
        just because Google has no
        session data available.
      */

      console.error(
        "Google Fit workout import error:",
        workoutError
      );
    }

    /*
      ------------------------------------------------
      UPDATE CONNECTION
      ------------------------------------------------
    */

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

          lastWorkoutSyncAt:
            FieldValue.serverTimestamp(),
        },
        {
          merge:
            true,
        }
      );

    /*
      ------------------------------------------------
      RESPONSE
      ------------------------------------------------
    */

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

      workoutSync,
    });
  } catch (
    error
  ) {
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
        status:
          500,
      }
    );
  }
}