export type WorkoutScoreInput = {
  age: number;
  averageHeartRate: number;
  durationMinutes: number;
};

export type WorkoutScoreResult = {
  maxHeartRate: number;
  heartRatePercentage: number;
  heartRateZone: string;
  points: number;
};

export function calculateMaxHeartRate(
  age: number
) {
  return 220 - age;
}

export function calculateHeartRatePercentage(
  averageHeartRate: number,
  maxHeartRate: number
) {
  if (
    averageHeartRate <= 0 ||
    maxHeartRate <= 0
  ) {
    return 0;
  }

  return Number(
    (
      (averageHeartRate /
        maxHeartRate) *
      100
    ).toFixed(1)
  );
}

export function getHeartRateZone(
  percentage: number
) {
  if (
    percentage >= 90
  ) {
    return "90%+";
  }

  if (
    percentage >= 80
  ) {
    return "80-89%";
  }

  if (
    percentage >= 70
  ) {
    return "70-79%";
  }

  if (
    percentage >= 60
  ) {
    return "60-69%";
  }

  if (
    percentage >= 50
  ) {
    return "50-59%";
  }

  return "Below 50%";
}

export function calculatePoints(
  heartRatePercentage: number,
  durationMinutes: number
) {
  /*
    HYBRID HUMAN WORKOUT SCORING

    Max heart rate:
    220 - age

    Scoring rules:

    80%+ max HR for 30+ min = 30 points

    70%+ max HR for 60+ min = 30 points

    70%+ max HR for 30+ min = 20 points

    60%+ max HR for 60+ min = 20 points

    60%+ max HR for 30+ min = 10 points

    50%+ max HR for 60+ min = 10 points

    Anything below these thresholds = 0 points
  */

  if (
    heartRatePercentage >= 80 &&
    durationMinutes >= 30
  ) {
    return 30;
  }

  if (
    heartRatePercentage >= 70 &&
    durationMinutes >= 60
  ) {
    return 30;
  }

  if (
    heartRatePercentage >= 70 &&
    durationMinutes >= 30
  ) {
    return 20;
  }

  if (
    heartRatePercentage >= 60 &&
    durationMinutes >= 60
  ) {
    return 20;
  }

  if (
    heartRatePercentage >= 60 &&
    durationMinutes >= 30
  ) {
    return 10;
  }

  if (
    heartRatePercentage >= 50 &&
    durationMinutes >= 60
  ) {
    return 10;
  }

  return 0;
}

export function scoreWorkout({
  age,
  averageHeartRate,
  durationMinutes,
}: WorkoutScoreInput): WorkoutScoreResult {
  const maxHeartRate =
    calculateMaxHeartRate(
      age
    );

  const heartRatePercentage =
    calculateHeartRatePercentage(
      averageHeartRate,
      maxHeartRate
    );

  const heartRateZone =
    getHeartRateZone(
      heartRatePercentage
    );

  const points =
    calculatePoints(
      heartRatePercentage,
      durationMinutes
    );

  return {
    maxHeartRate,
    heartRatePercentage,
    heartRateZone,
    points,
  };
}