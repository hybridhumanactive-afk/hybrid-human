import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";

type WorkoutData = {
  date: string;
  points: number;
};

type UserProfile = {
  firstName?: string;
  lastName?: string;
  company?: string;
  department?: string;
};

export function getCurrentWeekKey() {
  const now = new Date();

  const day = now.getDay();

  const difference =
    day === 0
      ? -6
      : 1 - day;

  const monday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() + difference
  );

  const year =
    monday.getFullYear();

  const month = String(
    monday.getMonth() + 1
  ).padStart(2, "0");

  const date = String(
    monday.getDate()
  ).padStart(2, "0");

  return `${year}-${month}-${date}`;
}

export function getCurrentMonthKey() {
  const now = new Date();

  const year =
    now.getFullYear();

  const month = String(
    now.getMonth() + 1
  ).padStart(2, "0");

  return `${year}-${month}`;
}

export async function syncLeaderboard(
  userId: string
) {
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

  if (!profileSnapshot.exists()) {
    throw new Error(
      "User profile does not exist."
    );
  }

  const profile =
    profileSnapshot.data() as UserProfile;

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

  const workouts: WorkoutData[] =
    workoutSnapshot.docs.map(
      (workoutDocument) => {
        const data =
          workoutDocument.data();

        return {
          date:
            data.date || "",

          points:
            Number(
              data.points || 0
            ),
        };
      }
    );

  const weekKey =
    getCurrentWeekKey();

  const monthKey =
    getCurrentMonthKey();

  const weeklyPoints =
    workouts
      .filter(
        (workout) =>
          workout.date >=
          weekKey
      )
      .reduce(
        (
          total,
          workout
        ) =>
          total +
          workout.points,
        0
      );

  const monthlyPoints =
    workouts
      .filter(
        (workout) =>
          workout.date.startsWith(
            monthKey
          )
      )
      .reduce(
        (
          total,
          workout
        ) =>
          total +
          workout.points,
        0
      );

  const totalPoints =
    workouts.reduce(
      (
        total,
        workout
      ) =>
        total +
        workout.points,
      0
    );

  const weeklyWorkouts =
    workouts.filter(
      (workout) =>
        workout.date >=
        weekKey
    ).length;

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

      weeklyPoints,

      monthlyPoints,

      totalPoints,

      weeklyWorkouts,

      weekKey,

      monthKey,

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
    weeklyWorkouts,
  };
}