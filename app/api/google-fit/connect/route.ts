import { NextResponse } from "next/server";
import crypto from "crypto";

export async function GET(request: Request) {
  const clientId =
    process.env.GOOGLE_FIT_CLIENT_ID ||
    process.env.NEXT_PUBLIC_GOOGLE_FIT_CLIENT_ID;

  if (!clientId) {
    return NextResponse.json(
      {
        error:
          "GOOGLE_FIT_CLIENT_ID is missing.",
      },
      {
        status: 500,
      }
    );
  }

  const requestUrl =
    new URL(request.url);

  const origin =
    requestUrl.origin;

  const redirectUri =
    process.env.GOOGLE_FIT_REDIRECT_URI ||
    `${origin}/api/google-fit/callback`;

  const state =
    crypto
      .randomBytes(32)
      .toString("hex");

  const scopes = [
    "https://www.googleapis.com/auth/fitness.activity.read",
    "https://www.googleapis.com/auth/fitness.body.read",
    "https://www.googleapis.com/auth/fitness.heart_rate.read",
    "https://www.googleapis.com/auth/fitness.location.read",
    "https://www.googleapis.com/auth/fitness.sleep.read",
  ];

  const params =
    new URLSearchParams({
      client_id:
        clientId,

      redirect_uri:
        redirectUri,

      response_type:
        "code",

      scope:
        scopes.join(" "),

      access_type:
        "offline",

      include_granted_scopes:
        "true",

      prompt:
        "consent",

      state,
    });

  const googleAuthorizationUrl =
    `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

  const response =
    NextResponse.redirect(
      googleAuthorizationUrl
    );

  response.cookies.set(
    "google_fit_oauth_state",
    state,
    {
      httpOnly: true,

      secure:
        process.env.NODE_ENV ===
        "production",

      sameSite:
        "lax",

      maxAge:
        60 * 10,

      path:
        "/",
    }
  );

  return response;
}