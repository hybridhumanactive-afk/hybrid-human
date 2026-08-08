import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
} from "firebase/firestore";

import {
  db,
} from "@/lib/firebase";

import type {
  DeviceConnection,
  DeviceProvider,
} from "@/lib/integrations";

export async function getDeviceConnection(
  userId: string,
  provider: DeviceProvider
): Promise<DeviceConnection | null> {
  const reference =
    doc(
      db,
      "users",
      userId,
      "deviceConnections",
      provider
    );

  const snapshot =
    await getDoc(
      reference
    );

  if (!snapshot.exists()) {
    return null;
  }

  const data =
    snapshot.data();

  return {
    provider,

    status:
      data.status ??
      "not_connected",

    connectedAt:
      data.connectedAt ??
      undefined,

    lastSyncAt:
      data.lastSyncAt ??
      undefined,

    externalUserId:
      data.externalUserId ??
      undefined,

    errorMessage:
      data.errorMessage ??
      undefined,
  };
}

export async function setDeviceConnectionStatus(
  userId: string,
  provider: DeviceProvider,
  status:
    | "not_connected"
    | "pending"
    | "connected"
    | "error"
) {
  const reference =
    doc(
      db,
      "users",
      userId,
      "deviceConnections",
      provider
    );

  await setDoc(
    reference,
    {
      provider,

      status,

      updatedAt:
        serverTimestamp(),

      ...(status === "connected"
        ? {
            connectedAt:
              serverTimestamp(),
          }
        : {}),
    },
    {
      merge: true,
    }
  );
}

export async function connectSamsungHealth(
  userId: string
) {
  const reference =
    doc(
      db,
      "users",
      userId,
      "deviceConnections",
      "samsung"
    );

  await setDoc(
    reference,
    {
      provider:
        "samsung",

      status:
        "pending",

      connectionRequestedAt:
        serverTimestamp(),

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}

export async function disconnectSamsungHealth(
  userId: string
) {
  const reference =
    doc(
      db,
      "users",
      userId,
      "deviceConnections",
      "samsung"
    );

  await setDoc(
    reference,
    {
      provider:
        "samsung",

      status:
        "not_connected",

      updatedAt:
        serverTimestamp(),
    },
    {
      merge: true,
    }
  );
}