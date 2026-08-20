import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

type WorkoutData = {
  date: string;
  points: number;
};

type GoogleFitDailyData = {
  date: string;
  steps: number;
};

type UserProfile = {
  firstName?: string;
  lastName?: string;
  company?: string;
  department?: string;
};

export type LeaderboardSyncResult = {
  weeklyPoints: number;
  monthlyPoints: number;
  totalPoints: number;

  weeklyWorkoutPoints: number;
  monthlyWorkoutPoints: number;
  totalWorkoutPoints: number;

  weeklyStepPoints: number;
  monthlyStepPoints: number;
  totalStepPoints: number;

  weeklySteps: number;
  monthlySteps: number;
  totalSteps: number;

  weeklyWorkouts: number;
};

export function getCurrentWeekKey() {
  const now =
    new Date();

  const day =
    now.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  const monday =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() +
        difference
    );

  const year =
    monday.getFullYear();

  const month =
    String(
      monday.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  const date =
    String(
      monday.getDate()
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}-${date}`;
}

export function getCurrentMonthKey() {
  const now =
    new Date();

  const year =
    now.getFullYear();

  const month =
    String(
      now.getMonth() + 1
    ).padStart(
      2,
      "0"
    );

  return `${year}-${month}`;
}

/*
  HYBRID HUMAN STEP SCORING

  Every complete 1,000 steps:
  1 point

  Examples:

  999 steps
  = 0 points

  1,000 steps
  = 1 point

  5,850 steps
  = 5 points

  10,000 steps
  = 10 points

  15,000 steps
  = 10 points

  Daily maximum:
  10 points
*/

export function calculateStepPoints(
  steps: number
) {
  if (
    !Number.isFinite(
      steps
    ) ||
    steps <= 0
  ) {
    return 0;
  }

  const points =
    Math.floor(
      steps / 1000
    );

  return Math.min(
    points,
    10
  );
}

export async function syncLeaderboard(
  userId: string
): Promise<LeaderboardSyncResult> {
  /*
    --------------------------------------------------
    LOAD USER PROFILE
    --------------------------------------------------
  */

  const profileReference =
    doc(
      db,
      "users",
      userId
    );

  const profileSnapshot =
    await getDoc(
      profileReference
    );

  if (
    !profileSnapshot.exists()
  ) {
    throw new Error(
      "User profile does not exist."
    );
  }

  const profile =
    profileSnapshot.data() as UserProfile;

  /*
    --------------------------------------------------
    LOAD WORKOUTS
    --------------------------------------------------
  */

  const workoutsReference =
    collection(
      db,
      "users",
      userId,
      "workouts"
    );

  const workoutSnapshot =
    await getDocs(
      workoutsReference
    );

  const workouts:
    WorkoutData[] =
    workoutSnapshot.docs.map(
      (
        workoutDocument
      ) => {
        const data =
          workoutDocument.data();

        return {
          date:
            typeof data.date ===
            "string"
              ? data.date
              : "",

          /*
            IMPORTANT:

            Workout "points" already contains:

            Base workout points
            +
            Challenge bonus points

            Therefore we use the final
            points value directly.
          */

          points:
            Number(
              data.points ||
                0
            ),
        };
      }
    );

  /*
    --------------------------------------------------
    LOAD GOOGLE FIT DAILY DATA
    --------------------------------------------------
  */

  const googleFitReference =
    collection(
      db,
      "users",
      userId,
      "googleFitDaily"
    );

  const googleFitSnapshot =
    await getDocs(
      googleFitReference
    );

  const googleFitDays:
    GoogleFitDailyData[] =
    googleFitSnapshot.docs.map(
      (
        healthDocument
      ) => {
        const data =
          healthDocument.data();

        return {
          date:
            typeof data.date ===
            "string"
              ? data.date
              : healthDocument.id,

          steps:
            Math.max(
              0,
              Number(
                data.steps ||
                  0
              )
            ),
        };
      }
    );

  /*
    --------------------------------------------------
    DATE KEYS
    --------------------------------------------------
  */

  const weekKey =
    getCurrentWeekKey();

  const monthKey =
    getCurrentMonthKey();

  /*
    --------------------------------------------------
    WORKOUT POINTS
    --------------------------------------------------
  */

  const weeklyWorkoutsData =
    workouts.filter(
      (
        workout
      ) =>
        workout.date >=
        weekKey
    );

  const monthlyWorkoutsData =
    workouts.filter(
      (
        workout
      ) =>
        workout.date.startsWith(
          monthKey
        )
    );

  const weeklyWorkoutPoints =
    weeklyWorkoutsData.reduce(
      (
        total,
        workout
      ) =>
        total +
        workout.points,
      0
    );

  const monthlyWorkoutPoints =
    monthlyWorkoutsData.reduce(
      (
        total,
        workout
      ) =>
        total +
        workout.points,
      0
    );

  const totalWorkoutPoints =
    workouts.reduce(
      (
        total,
        workout
      ) =>
        total +
        workout.points,
      0
    );

  /*
    --------------------------------------------------
    GOOGLE FIT DAYS
    --------------------------------------------------
  */

  const weeklyGoogleFitDays =
    googleFitDays.filter(
      (
        day
      ) =>
        day.date >=
        weekKey
    );

  const monthlyGoogleFitDays =
    googleFitDays.filter(
      (
        day
      ) =>
        day.date.startsWith(
          monthKey
        )
    );

  /*
    --------------------------------------------------
    STEP TOTALS
    --------------------------------------------------
  */

  const weeklySteps =
    weeklyGoogleFitDays.reduce(
      (
        total,
        day
      ) =>
        total +
        day.steps,
      0
    );

  const monthlySteps =
    monthlyGoogleFitDays.reduce(
      (
        total,
        day
      ) =>
        total +
        day.steps,
      0
    );

  const totalSteps =
    googleFitDays.reduce(
      (
        total,
        day
      ) =>
        total +
        day.steps,
      0
    );

  /*
    --------------------------------------------------
    STEP POINTS

    We calculate points PER DAY.

    This is important because the
    10-point cap applies to each day,
    not to the entire week/month.
    --------------------------------------------------
  */

  const weeklyStepPoints =
    weeklyGoogleFitDays.reduce(
      (
        total,
        day
      ) =>
        total +
        calculateStepPoints(
          day.steps
        ),
      0
    );

  const monthlyStepPoints =
    monthlyGoogleFitDays.reduce(
      (
        total,
        day
      ) =>
        total +
        calculateStepPoints(
          day.steps
        ),
      0
    );

  const totalStepPoints =
    googleFitDays.reduce(
      (
        total,
        day
      ) =>
        total +
        calculateStepPoints(
          day.steps
        ),
      0
    );

  /*
    --------------------------------------------------
    FINAL HYBRID POINTS

    Workout points already include:
    base workout score
    +
    challenge bonuses

    We now add Google Fit step points.
    --------------------------------------------------
  */

  const weeklyPoints =
    weeklyWorkoutPoints +
    weeklyStepPoints;

  const monthlyPoints =
    monthlyWorkoutPoints +
    monthlyStepPoints;

  const totalPoints =
    totalWorkoutPoints +
    totalStepPoints;

  const weeklyWorkouts =
    weeklyWorkoutsData.length;

  /*
    --------------------------------------------------
    UPDATE LEADERBOARD
    --------------------------------------------------
  */

  const leaderboardReference =
    doc(
      db,
      "leaderboardEntries",
      userId
    );

  await setDoc(
    leaderboardReference,
    {
      uid:
        userId,

      firstName:
        profile.firstName ||
        "Athlete",

      lastName:
        profile.lastName ||
        "",

      company:
        profile.company ||
        "",

      department:
        profile.department ||
        "",

      /*
        Final combined scores
      */

      weeklyPoints,

      monthlyPoints,

      totalPoints,

      /*
        Workout breakdown
      */

      weeklyWorkoutPoints,

      monthlyWorkoutPoints,

      totalWorkoutPoints,

      /*
        Step point breakdown
      */

      weeklyStepPoints,

      monthlyStepPoints,

      totalStepPoints,

      /*
        Raw step totals
      */

      weeklySteps,

      monthlySteps,

      totalSteps,

      /*
        Workout count
      */

      weeklyWorkouts,

      /*
        Period identifiers
      */

      weekKey,

      monthKey,

      /*
        Scoring information
      */

      stepPointsPer:
        1000,

      maximumDailyStepPoints:
        10,

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );

  return {
    weeklyPoints,

    monthlyPoints,

    totalPoints,

    weeklyWorkoutPoints,

    monthlyWorkoutPoints,

    totalWorkoutPoints,

    weeklyStepPoints,

    monthlyStepPoints,

    totalStepPoints,

    weeklySteps,

    monthlySteps,

    totalSteps,

    weeklyWorkouts,
  };
}