import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import { db } from "@/lib/firebase";
import { getCurrentWeekKey } from "@/lib/leaderboard";

export type WorkoutChallengeInput = {
  userId: string;
  workoutType: string;
  durationMinutes: number;
  distanceKm: number;
  heartRatePercentage: number;
};

export type ChallengeDefinition = {
  id: string;
  name: string;
  description: string;
  bonusPoints: number;
};

export type EarnedChallenge = {
  id: string;
  name: string;
  description: string;
  bonusPoints: number;
};

export const CHALLENGES: ChallengeDefinition[] = [
  {
    id: "10k-finisher",
    name: "10K Finisher",
    description:
      "Complete a running workout of at least 10 km.",
    bonusPoints: 20,
  },
  {
    id: "intensity-warrior",
    name: "Intensity Warrior",
    description:
      "Complete at least 60 minutes at 80% or more of your calculated maximum heart rate.",
    bonusPoints: 20,
  },
  {
    id: "endurance-session",
    name: "Endurance Session",
    description:
      "Complete a workout lasting at least 90 minutes.",
    bonusPoints: 10,
  },
];

function challengePassed(
  challengeId: string,
  input: WorkoutChallengeInput
) {
  if (challengeId === "10k-finisher") {
    return (
      input.workoutType === "Running" &&
      input.distanceKm >= 10
    );
  }

  if (challengeId === "intensity-warrior") {
    return (
      input.durationMinutes >= 60 &&
      input.heartRatePercentage >= 80
    );
  }

  if (challengeId === "endurance-session") {
    return input.durationMinutes >= 90;
  }

  return false;
}

export async function evaluateWorkoutChallenges(
  input: WorkoutChallengeInput
) {
  const weekKey = getCurrentWeekKey();

  const earnedChallenges: EarnedChallenge[] = [];

  for (const challenge of CHALLENGES) {
    const passed = challengePassed(
      challenge.id,
      input
    );

    if (!passed) {
      continue;
    }

    const progressId =
      `${challenge.id}-${weekKey}`;

    const progressReference = doc(
      db,
      "users",
      input.userId,
      "challengeProgress",
      progressId
    );

    const existingProgress =
      await getDoc(progressReference);

    if (existingProgress.exists()) {
      continue;
    }

    await setDoc(progressReference, {
      challengeId: challenge.id,

      challengeName: challenge.name,

      description: challenge.description,

      bonusPoints: challenge.bonusPoints,

      weekKey,

      completed: true,

      completedAt: serverTimestamp(),
    });

    earnedChallenges.push({
      id: challenge.id,
      name: challenge.name,
      description: challenge.description,
      bonusPoints: challenge.bonusPoints,
    });
  }

  const totalBonusPoints =
    earnedChallenges.reduce(
      (total, challenge) =>
        total + challenge.bonusPoints,
      0
    );

  return {
    earnedChallenges,
    totalBonusPoints,
  };
}