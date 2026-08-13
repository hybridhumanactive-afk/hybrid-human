import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const url = new URL(request.url);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const oauthError = url.searchParams.get("error");

  const cookieHeader =
    request.headers.get("cookie") || "";

  const stateCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) =>
      cookie.startsWith(
        "google_fit_oauth_state="
      )
    );

  const savedState = stateCookie
    ? decodeURIComponent(
        stateCookie
          .split("=")
          .slice(1)
          .join("=")
      )
    : null;

  const siteOrigin = url.origin;

  const redirectUri =
    process.env.GOOGLE_FIT_REDIRECT_URI ||
    `${siteOrigin}/api/google-fit/callback`;

  if (oauthError) {
    return NextResponse.redirect(
      `${siteOrigin}/integrations/google-fit?error=${encodeURIComponent(
        oauthError
      )}`
    );
  }

  if (!code) {
    return NextResponse.redirect(
      `${siteOrigin}/integrations/google-fit?error=no_code`
    );
  }

  if (
    !state ||
    !savedState ||
    state !== savedState
  ) {
    return NextResponse.redirect(
      `${siteOrigin}/integrations/google-fit?error=invalid_state`
    );
  }

  const clientId =
    process.env.GOOGLE_FIT_CLIENT_ID ||
    process.env
      .NEXT_PUBLIC_GOOGLE_FIT_CLIENT_ID;

  const clientSecret =
    process.env.GOOGLE_FIT_CLIENT_SECRET;

  if (
    !clientId ||
    !clientSecret
  ) {
    return NextResponse.redirect(
      `${siteOrigin}/integrations/google-fit?error=missing_server_credentials`
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
      await tokenResponse.json();

    if (!tokenResponse.ok) {
      console.error(
        "Google token exchange failed:",
        tokens
      );

      return NextResponse.redirect(
        `${siteOrigin}/integrations/google-fit?error=token_exchange_failed`
      );
    }

    console.log(
      "Google Fit OAuth successful."
    );

    console.log(
      "Access token received:",
      Boolean(
        tokens.access_token
      )
    );

    console.log(
      "Refresh token received:",
      Boolean(
        tokens.refresh_token
      )
    );

    const response =
      NextResponse.redirect(
        `${siteOrigin}/integrations/google-fit?oauth=success`
      );

    response.cookies.delete(
      "google_fit_oauth_state"
    );

    return response;
  } catch (error) {
    console.error(
      "Google Fit callback error:",
      error
    );

    return NextResponse.redirect(
      `${siteOrigin}/integrations/google-fit?error=callback_failed`
    );
  }
}