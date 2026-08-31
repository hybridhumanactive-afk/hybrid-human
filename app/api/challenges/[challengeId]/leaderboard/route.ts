import { NextRequest, NextResponse } from "next/server";

import { adminAuth, adminDb } from "@/lib/firebase-admin";

type RouteContext = {
  params: Promise<{
    challengeId: string;
  }>;
};

function calculateStepPoints(steps: number) {
  if (!Number.isFinite(steps) || steps <= 0) {
    return 0;
  }

  return Math.min(Math.floor(steps / 1000), 10);
}

function getBearerToken(request: NextRequest) {
  const authorization = request.headers.get("authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return "";
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const token = getBearerToken(request);

    if (!token) {
      return NextResponse.json(
        { success: false, error: "Unauthorized." },
        { status: 401 }
      );
    }

    const decodedToken = await adminAuth.verifyIdToken(token);
    const { challengeId } = await context.params;

    const challengeRef = adminDb
      .collection("socialChallenges")
      .doc(challengeId);

    const challengeSnapshot = await challengeRef.get();

    if (!challengeSnapshot.exists) {
      return NextResponse.json(
        { success: false, error: "Challenge not found." },
        { status: 404 }
      );
    }

    const challenge = challengeSnapshot.data() ?? {};
    const startDate = String(challenge.startDate ?? "");
    const endDate = String(challenge.endDate ?? "");

    if (!startDate || !endDate) {
      return NextResponse.json(
        { success: false, error: "Challenge dates are missing." },
        { status: 400 }
      );
    }

    const memberSnapshot = await challengeRef
      .collection("members")
      .get();

    const memberIds = memberSnapshot.docs.map((item) => item.id);

    const isCreator =
      String(challenge.createdBy ?? "") === decodedToken.uid;

    const isMember = memberIds.includes(decodedToken.uid);

    if (!isCreator && !isMember) {
      return NextResponse.json(
        {
          success: false,
          error: "You are not a member of this challenge.",
        },
        { status: 403 }
      );
    }

    const leaderboard = [];

    for (const memberDocument of memberSnapshot.docs) {
      const member = memberDocument.data();
      const uid = String(member.uid ?? memberDocument.id);

      const userRef = adminDb.collection("users").doc(uid);

      const [
        profileSnapshot,
        workoutsSnapshot,
        googleFitSnapshot,
      ] = await Promise.all([
        userRef.get(),

        userRef
          .collection("workouts")
          .where("date", ">=", startDate)
          .where("date", "<=", endDate)
          .get(),

        userRef
          .collection("googleFitDaily")
          .where("date", ">=", startDate)
          .where("date", "<=", endDate)
          .get(),
      ]);

      const profile = profileSnapshot.exists
        ? profileSnapshot.data() ?? {}
        : {};

      const workoutPoints = workoutsSnapshot.docs.reduce(
        (total, workoutDocument) =>
          total + Number(workoutDocument.data().points ?? 0),
        0
      );

      const stepPoints = googleFitSnapshot.docs.reduce(
        (total, healthDocument) =>
          total +
          calculateStepPoints(
            Math.max(0, Number(healthDocument.data().steps ?? 0))
          ),
        0
      );

      leaderboard.push({
        uid,
        email: String(member.email ?? ""),
        displayName: String(
          member.displayName ??
            `${profile.firstName ?? ""} ${profile.lastName ?? ""}`.trim() ??
            "Hybrid Human"
        ),
        company: String(profile.company ?? ""),
        department: String(profile.department ?? ""),
        workoutPoints,
        stepPoints,
        points: workoutPoints + stepPoints,
      });
    }

    leaderboard.sort((a, b) => b.points - a.points);

    return NextResponse.json({
      success: true,
      challenge: {
        id: challengeId,
        name: String(challenge.name ?? "Challenge"),
        type:
          challenge.type === "corporate" ? "corporate" : "friends",
        company: String(challenge.company ?? ""),
        startDate,
        endDate,
      },
      leaderboard,
    });
  } catch (error) {
    console.error("Challenge leaderboard API error:", error);

    return NextResponse.json(
      {
        success: false,
        error:
          error instanceof Error
            ? error.message
            : "Unable to load challenge leaderboard.",
      },
      { status: 500 }
    );
  }
}
