import { NextRequest, NextResponse } from 'next/server';
import { google } from 'googleapis';

// Fetches Google Calendar events server-side using the user's stored tokens.
// The client passes the tokens (already in Firestore user doc), gets back events,
// and saves them to Firestore via the client SDK.
export async function POST(request: NextRequest) {
  const body = await request.json() as {
    accessToken: string;
    refreshToken: string;
    expiresAt: number;
  };

  const { accessToken, refreshToken, expiresAt } = body;
  if (!accessToken) {
    return NextResponse.json({ error: 'Missing access token' }, { status: 400 });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID!;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET!;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

  const oAuth2Client = new google.auth.OAuth2(clientId, clientSecret, `${appUrl}/api/gcal`);
  oAuth2Client.setCredentials({
    access_token: accessToken,
    refresh_token: refreshToken,
    expiry_date: expiresAt,
  });

  const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });
  const now = new Date();
  const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  try {
    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: thirtyDaysLater.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = (response.data.items ?? []).map((e) => ({
      googleEventId: e.id,
      title: e.summary,
      description: e.description ?? '',
      dueDate: e.start?.date ?? e.start?.dateTime?.slice(0, 10),
      startTime: e.start?.dateTime?.slice(11, 16),
      endTime: e.end?.dateTime?.slice(11, 16),
    }));

    return NextResponse.json({ events });
  } catch (err) {
    console.error('[GCal Sync]', err);
    return NextResponse.json({ error: 'Failed to fetch calendar events' }, { status: 500 });
  }
}
