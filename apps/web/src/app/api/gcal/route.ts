import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Google Calendar OAuth callback
// Google redirects here with ?code=...&state=uid after user grants access
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const state = searchParams.get('state'); // uid
  const error = searchParams.get('error');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (error) {
    return NextResponse.redirect(
      new URL(`/settings?gcal_error=${encodeURIComponent(error)}`, request.url)
    );
  }

  if (!code || !state) {
    return NextResponse.redirect(new URL('/settings?gcal_error=no_code', request.url));
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(new URL('/settings?gcal_error=config', request.url));
  }

  try {
    const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/gcal`);
    const { tokens } = await oAuth2Client.getToken(code);

    // Pass tokens + uid to the client via query params so it can save to Firestore
    // The settings page reads these, saves to Firestore, then removes them from the URL
    const payload = Buffer.from(
      JSON.stringify({
        uid: state,
        accessToken: tokens.access_token,
        refreshToken: tokens.refresh_token,
        expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
      })
    ).toString('base64url');

    return NextResponse.redirect(new URL(`/settings?gcal_payload=${payload}`, request.url));
  } catch (err) {
    console.error('[GCal] Token exchange failed:', err);
    return NextResponse.redirect(new URL('/settings?gcal_error=token_exchange', request.url));
  }
}
