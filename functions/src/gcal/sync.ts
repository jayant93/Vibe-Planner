import { onCall, onRequest, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore } from 'firebase-admin/firestore';
import { google } from 'googleapis';

// ─── Secrets ─────────────────────────────────────────────────────────────────

const GOOGLE_CLIENT_ID = defineSecret('GOOGLE_CLIENT_ID');
const GOOGLE_CLIENT_SECRET = defineSecret('GOOGLE_CLIENT_SECRET');
const APP_URL = defineSecret('APP_URL');

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getOAuthClient(clientId: string, clientSecret: string, redirectUri: string) {
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

function isPro(userData: { subscription?: { plan?: string } }): boolean {
  return userData.subscription?.plan === 'pro';
}

// ─── Get Auth URL ─────────────────────────────────────────────────────────────

export const getGCalAuthUrl = onCall(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.data() as { subscription?: { plan?: string } };

    if (!isPro(userData)) {
      throw new HttpsError('permission-denied', 'Google Calendar sync requires Pro plan');
    }

    const redirectUri = `${APP_URL.value()}/api/gcal`;
    const oAuth2Client = getOAuthClient(
      GOOGLE_CLIENT_ID.value(),
      GOOGLE_CLIENT_SECRET.value(),
      redirectUri
    );

    const authUrl = oAuth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: ['https://www.googleapis.com/auth/calendar'],
      state: uid, // pass uid in state so callback can associate tokens
      prompt: 'consent',
    });

    return { authUrl };
  }
);

// ─── OAuth Callback ───────────────────────────────────────────────────────────

export const gcalOAuthCallback = onRequest(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, APP_URL] },
  async (req, res) => {
    const code = req.query['code'] as string | undefined;
    const uid = req.query['state'] as string | undefined;

    if (!code || !uid) {
      res.status(400).send('Missing code or state');
      return;
    }

    try {
      const redirectUri = `${APP_URL.value()}/api/gcal`;
      const oAuth2Client = getOAuthClient(
        GOOGLE_CLIENT_ID.value(),
        GOOGLE_CLIENT_SECRET.value(),
        redirectUri
      );

      const { tokens } = await oAuth2Client.getToken(code);

      const db = getFirestore();
      await db.doc(`users/${uid}`).set(
        {
          gcalLinked: true,
          gcalTokens: {
            accessToken: tokens.access_token,
            refreshToken: tokens.refresh_token,
            expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
          },
        },
        { merge: true }
      );

      res.redirect(`${APP_URL.value()}/settings?gcal_connected=true`);
    } catch (err) {
      console.error('[GCal OAuth] Token exchange failed:', err);
      res.redirect(`${APP_URL.value()}/settings?gcal_error=token_exchange`);
    }
  }
);

// ─── Sync Calendar ────────────────────────────────────────────────────────────

export const syncGoogleCalendar = onCall(
  { secrets: [GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET] },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    const userData = userSnap.data() as {
      subscription?: { plan?: string };
      gcalLinked?: boolean;
      gcalTokens?: { accessToken: string; refreshToken: string; expiresAt: number };
    };

    if (!isPro(userData)) {
      throw new HttpsError('permission-denied', 'Google Calendar sync requires Pro plan');
    }
    if (!userData.gcalLinked || !userData.gcalTokens) {
      throw new HttpsError('failed-precondition', 'Google Calendar not connected');
    }

    const oAuth2Client = getOAuthClient(
      GOOGLE_CLIENT_ID.value(),
      GOOGLE_CLIENT_SECRET.value(),
      ''
    );
    oAuth2Client.setCredentials({
      access_token: userData.gcalTokens.accessToken,
      refresh_token: userData.gcalTokens.refreshToken,
      expiry_date: userData.gcalTokens.expiresAt,
    });

    // Refresh token if needed
    oAuth2Client.on('tokens', async (tokens) => {
      if (tokens.access_token) {
        await db.doc(`users/${uid}`).set(
          {
            gcalTokens: {
              accessToken: tokens.access_token,
              expiresAt: tokens.expiry_date ?? Date.now() + 3600_000,
            },
          },
          { merge: true }
        );
      }
    });

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    // Fetch events for next 30 days
    const now = new Date();
    const thirtyDaysLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const response = await calendar.events.list({
      calendarId: 'primary',
      timeMin: now.toISOString(),
      timeMax: thirtyDaysLater.toISOString(),
      singleEvents: true,
      orderBy: 'startTime',
      maxResults: 100,
    });

    const events = response.data.items ?? [];
    const batch = db.batch();
    const tasksRef = db.collection(`users/${uid}/tasks`);

    let synced = 0;
    for (const event of events) {
      if (!event.id || !event.summary) continue;

      // Check if a task with this googleEventId already exists
      const existing = await tasksRef.where('googleEventId', '==', event.id).limit(1).get();

      const startDate = event.start?.date ?? event.start?.dateTime?.slice(0, 10);
      const startTime = event.start?.dateTime?.slice(11, 16);
      const endTime = event.end?.dateTime?.slice(11, 16);

      if (existing.empty) {
        const newTaskRef = tasksRef.doc();
        batch.set(newTaskRef, {
          userId: uid,
          title: event.summary,
          description: event.description ?? '',
          priority: 3,
          status: 'todo',
          dueDate: startDate,
          startTime,
          endTime,
          recurrence: 'none',
          googleEventId: event.id,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
        synced++;
      } else {
        const docRef = existing.docs[0]?.ref;
        if (docRef) {
          batch.update(docRef, {
            title: event.summary,
            dueDate: startDate,
            startTime,
            endTime,
            updatedAt: new Date(),
          });
        }
      }
    }

    await batch.commit();
    return { synced };
  }
);
