import {
  NextRequest,
  NextResponse,
} from "next/server";

import {
  FieldValue,
} from "firebase-admin/firestore";

import {
  adminDb,
} from "@/lib/firebase-admin";

type GoogleTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  id_token?: string;
  error?: string;
  error_description?: string;
};

export async function GET(
  request: NextRequest
) {
  const url =
    new URL(
      request.url
    );

  const code =
    url.searchParams.get(
      "code"
    );

  const returnedState =
    url.searchParams.get(
      "state"
    );

  const oauthError =
    url.searchParams.get(
      "error"
    );

  const savedState =
    request.cookies.get(
      "google_fit_oauth_state"
    )?.value;

  const uid =
    request.cookies.get(
      "google_fit_uid"
    )?.value;

  const appUrl =
    process.env.APP_URL ||
    "https://thunderous-nasturtium-ff7bdd.netlify.app";

  const redirectUri =
    process.env
      .GOOGLE_FIT_REDIRECT_URI ||
    `${appUrl}/api/google-fit/callback`;

  if (oauthError) {
    return NextResponse.redirect(
      `${appUrl}/integrations/google-fit?error=${encodeURIComponent(
        oauthError
      )}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${appUrl}/integrations/google-fit?error=no_code`
    );
  }

  if (
    !returnedState ||
    !savedState ||
    returnedState !==
      savedState
  ) {
    return NextResponse.redirect(
      `${appUrl}/integrations/google-fit?error=invalid_state`
    );
  }

  if (!uid) {
    return NextResponse.redirect(
      `${appUrl}/integrations/google-fit?error=missing_user`
    );
  }

  const clientId =
    process.env
      .GOOGLE_FIT_CLIENT_ID ||
    process.env
      .NEXT_PUBLIC_GOOGLE_FIT_CLIENT_ID;

  const clientSecret =
    process.env
      .GOOGLE_FIT_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    return NextResponse.redirect(
      `${appUrl}/integrations/google-fit?error=missing_server_credentials`
    );
  }

  try {
    const tokenResponse =
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
              code,
              client_id:
                clientId,
              client_secret:
                clientSecret,
              redirect_uri:
                redirectUri,
              grant_type:
                "authorization_code",
            }),

          cache:
            "no-store",
        }
      );

    const tokens =
      (await tokenResponse.json()) as GoogleTokenResponse;

    if (
      !tokenResponse.ok ||
      !tokens.access_token
    ) {
      console.error(
        "Google token exchange failed:",
        tokens
      );

      return NextResponse.redirect(
        `${appUrl}/integrations/google-fit?error=token_exchange_failed`
      );
    }

    const privateConnectionRef =
      adminDb
        .collection(
          "googleFitConnections"
        )
        .doc(
          uid
        );

    const previousConnection =
      await privateConnectionRef.get();

    const previousData =
      previousConnection.exists
        ? previousConnection.data()
        : undefined;

    const refreshToken =
      tokens.refresh_token ||
      previousData
        ?.refreshToken ||
      null;

    const expiresIn =
      tokens.expires_in ??
      3600;

    const expiresAt =
      Date.now() +
      expiresIn * 1000;

    await privateConnectionRef.set(
      {
        uid,

        provider:
          "google_fit",

        accessToken:
          tokens.access_token,

        refreshToken,

        tokenType:
          tokens.token_type ??
          "Bearer",

        scope:
          tokens.scope ??
          "",

        expiresIn,

        expiresAt,

        connectedAt:
          previousData
            ?.connectedAt ??
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    const publicConnectionRef =
      adminDb
        .collection(
          "users"
        )
        .doc(
          uid
        )
        .collection(
          "deviceConnections"
        )
        .doc(
          "google_fit"
        );

    await publicConnectionRef.set(
      {
        provider:
          "google_fit",

        status:
          "connected",

        connectedAt:
          FieldValue.serverTimestamp(),

        updatedAt:
          FieldValue.serverTimestamp(),
      },
      {
        merge: true,
      }
    );

    const response =
      NextResponse.redirect(
        `${appUrl}/integrations/google-fit?oauth=success`
      );

    response.cookies.delete(
      "google_fit_oauth_state"
    );

    response.cookies.delete(
      "google_fit_uid"
    );

    return response;
  } catch (error) {
    console.error(
      "Google Fit callback error:",
      error
    );

    return NextResponse.redirect(
      `${appUrl}/integrations/google-fit?error=callback_failed`
    );
  }
}