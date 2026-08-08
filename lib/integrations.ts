export type DeviceProvider =
  | "garmin"
  | "apple"
  | "samsung";

export type DeviceConnectionStatus =
  | "not_connected"
  | "pending"
  | "connected"
  | "error";

export type DeviceConnection = {
  provider: DeviceProvider;

  status: DeviceConnectionStatus;

  connectedAt?: unknown;

  lastSyncAt?: unknown;

  externalUserId?: string;

  errorMessage?: string;
};

export type ImportedWorkout = {
  externalId: string;

  provider: DeviceProvider;

  type: string;

  date: string;

  startTime?: string;

  durationMinutes: number;

  distanceKm: number;

  averageHeartRate: number;

  maxHeartRateRecorded?: number;

  calories?: number;

  steps?: number;
};

export type ImportedDailyMetrics = {
  provider: DeviceProvider;

  date: string;

  steps?: number;

  restingHeartRate?: number;

  sleepMinutes?: number;

  calories?: number;

  stress?: number;

  bodyBattery?: number;

  averageHeartRate?: number;

  maxHeartRate?: number;
};