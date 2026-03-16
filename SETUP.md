# Vibe Planner — Setup Guide

## Prerequisites

- Node.js 20+
- Firebase CLI: `npm install -g firebase-tools`
- A Firebase project with Firestore + Auth (Google provider) enabled

---

## 1. Firebase Project Setup

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project (or use existing)
3. Enable **Authentication** → Google Sign-In
4. Enable **Firestore Database** (start in production mode)
5. Note your project ID

### Update `.firebaserc`
```
"default": "your-actual-firebase-project-id"
```

### Login & init
```bash
firebase login
firebase use your-actual-firebase-project-id
```

---

## 2. Web App Environment Variables

Copy `.env.local.example` to `.env.local` in `apps/web/`:

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Fill in from **Firebase Console → Project Settings → Your Apps → Web app**:
- `NEXT_PUBLIC_FIREBASE_API_KEY`
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
- `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
- `NEXT_PUBLIC_FIREBASE_APP_ID`

---

## 3. Razorpay Setup

1. Create a [Razorpay account](https://razorpay.com)
2. Go to **Dashboard → Subscriptions → Plans** → Create a plan
   - Billing: Monthly · Amount: ₹415 · Currency: INR
   - Copy the **Plan ID** (starts with `plan_`)
3. Go to **Settings → API Keys** → Generate key pair
   - Copy **Key ID** (public) and **Key Secret** (private)
4. Go to **Settings → Webhooks** → Add webhook URL:
   ```
   https://your-region-your-project.cloudfunctions.net/razorpayWebhook
   ```
   Events to enable: `subscription.activated`, `subscription.charged`, `subscription.cancelled`, `subscription.expired`, `payment.failed`
   - Copy the **Webhook Secret**

### Set secrets in Firebase
```bash
firebase functions:secrets:set RAZORPAY_KEY_ID        # key_...
firebase functions:secrets:set RAZORPAY_KEY_SECRET     # secret key
firebase functions:secrets:set RAZORPAY_PLAN_ID        # plan_...
firebase functions:secrets:set RAZORPAY_WEBHOOK_SECRET # from webhook settings
```

### Add Key ID to web env
```
NEXT_PUBLIC_RAZORPAY_KEY_ID=rzp_test_...
```

---

## 4. AI Model API Keys

```bash
firebase functions:secrets:set GROQ_API_KEY       # https://console.groq.com
firebase functions:secrets:set GEMINI_API_KEY      # https://aistudio.google.com
firebase functions:secrets:set MISTRAL_API_KEY     # https://console.mistral.ai
firebase functions:secrets:set CEREBRAS_API_KEY    # https://inference.cerebras.ai
firebase functions:secrets:set CLAUDE_API_KEY      # https://console.anthropic.com
```

---

## 5. Google Calendar API

1. In Google Cloud Console, enable **Google Calendar API**
2. Create OAuth 2.0 credentials (Web application)
3. Add authorized redirect URI: `https://your-app.com/api/gcal`

```bash
firebase functions:secrets:set GOOGLE_CLIENT_ID
firebase functions:secrets:set GOOGLE_CLIENT_SECRET
firebase functions:secrets:set APP_URL   # e.g. https://your-app.vercel.app
```

---

## 6. Install & Run

```bash
# Install all workspace dependencies
npm install

# Start web dev server
npm run dev
# → http://localhost:3000

# Run Firebase emulators (auth + firestore + functions)
firebase emulators:start
```

---

## 7. Deploy

```bash
# Deploy Firestore rules + indexes
firebase deploy --only firestore

# Deploy Cloud Functions
npm run deploy:functions

# Deploy web (Vercel recommended)
# Push to GitHub and connect repo in Vercel dashboard
```

---

## Project Structure Quick Reference

| Path | What it is |
|---|---|
| `apps/web/src/lib/firebase.ts` | Firebase client + callable function wrappers |
| `apps/web/src/lib/store.ts` | Zustand global state |
| `packages/shared/src/types/` | TypeScript interfaces (source of truth) |
| `packages/shared/src/utils/gates.ts` | Feature gate logic — use `canUse()` everywhere |
| `functions/src/ai/optimizer.ts` | AI fallback chain (Groq→Gemini→Mistral / Gemini→Cerebras→Claude) |
| `functions/src/razorpay/webhooks.ts` | Razorpay billing lifecycle (subscriptions, webhooks) |
| `functions/src/gcal/sync.ts` | Google Calendar OAuth + 2-way sync |
| `functions/src/scheduled/streaks.ts` | Daily habit streak cron |
| `firestore.rules` | Security rules (subscription is server-write-only) |
