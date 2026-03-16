import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Generates the Google OAuth URL server-side (keeps client secret on server)
export async function GET(request: NextRequest) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Google OAuth not configured' }, { status: 500 });
  }

  // uid is passed as a query param — used as OAuth state so callback knows which user
  const uid = request.nextUrl.searchParams.get('uid');
  if (!uid) {
    return NextResponse.json({ error: 'Missing uid' }, { status: 400 });
  }

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/gcal`);

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: ['https://www.googleapis.com/auth/calendar'],
    state: uid,
    prompt: 'consent',
  });

  return NextResponse.json({ authUrl });
}
