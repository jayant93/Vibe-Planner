# Vibe Planner

A full-featured AI-powered life planner built with Next.js 14, Firebase, and Groq AI. Plan your day, week, and month with intelligent scheduling, habit tracking, time logging, and Google Calendar sync.

---

## Features

- **Day / Week / Month Planner** — FullCalendar-powered views with recurring task expansion
- **Recurring Tasks** — Daily and alternate-day recurrence with configurable end dates
- **Habit Tracker** — Daily habit streaks with calendar heatmap (Pro)
- **AI Helper** — Generate a full week's task plan using Groq LLaMA AI
- **AI Schedule Optimizer** — Reorder your day intelligently via Firebase Cloud Function
- **Google Calendar Sync** — Import events from Google Calendar as tasks
- **Time Logger** — Log time across 4 life categories (Mind, Body, Soul, Work) with donut chart
- **Dashboard** — Weekly overview, category cards, habits summary, and time balance
- **Pro Tier** — Monthly view, habit streaks, and advanced features via Razorpay subscription
- **Mobile Responsive** — Bottom nav + slide-over drawer for mobile; sidebar for desktop
- **Dark Mode** — System-aware with manual override

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, TypeScript |
| Styling | Tailwind CSS v3, custom `brand-` color scale |
| State | Zustand with `subscribeWithSelector` |
| Database | Firebase Firestore (real-time `onSnapshot`) |
| Auth | Firebase Auth (Google OAuth) |
| Backend | Firebase Cloud Functions (Node 20) |
| Calendar UI | FullCalendar v6 (timeGrid + dayGrid) |
| AI | Groq API (LLaMA 3.1 70B) |
| Payments | Razorpay subscriptions |
| Hosting | Firebase App Hosting |
| Monorepo | npm workspaces + Turborepo |

---

## Project Structure

```
vibe-planner/
├── apps/
│   └── web/                    # Next.js 14 app
│       ├── src/
│       │   ├── app/            # App Router pages & API routes
│       │   ├── components/     # React components
│       │   │   ├── planner/    # DayView, WeekView, MonthView, TaskModal...
│       │   │   ├── habits/     # HabitsView, HabitModal
│       │   │   ├── ai/         # AIHelperView, AIScheduleButton
│       │   │   └── ui/         # AppShell, AuthProvider, SettingsView...
│       │   └── lib/            # firebase.ts, store.ts, utils.ts
│       └── .env.local.example  # Required env vars template
├── functions/                  # Firebase Cloud Functions
│   └── src/
│       ├── index.ts            # Function exports
│       ├── ai/optimizer.ts     # Schedule optimization
│       ├── razorpay/           # Payment webhooks
│       └── scheduled/streaks.ts # Daily streak update
├── packages/
│   └── shared/                 # Shared types & utilities
│       └── src/
│           ├── types/index.ts  # Task, Habit, UserProfile, Subscription...
│           └── utils/gates.ts  # Feature gate logic (free vs pro)
├── firestore.rules             # Security rules
├── apphosting.yaml             # Firebase App Hosting config
└── turbo.json                  # Turborepo pipeline
```

---

## Getting Started

### 1. Clone & Install

```bash
git clone https://github.com/YOUR_USERNAME/vibe-planner.git
cd vibe-planner
npm install
```

### 2. Set up Firebase

1. Create a project at [console.firebase.google.com](https://console.firebase.google.com)
2. Enable **Authentication** (Google provider)
3. Enable **Firestore** (production mode)
4. Enable **Cloud Functions**
5. Copy your Firebase config

### 3. Set up Google OAuth for Calendar Sync

1. Go to [Google Cloud Console → Credentials](https://console.cloud.google.com/apis/credentials)
2. Create an OAuth 2.0 Client ID (Web application)
3. Add authorized redirect URI: `http://localhost:3000/api/gcal`
4. Enable the **Google Calendar API**

### 4. Get a Groq API Key

Sign up at [console.groq.com](https://console.groq.com) (free tier available).

### 5. Configure Environment Variables

```bash
cp apps/web/.env.local.example apps/web/.env.local
```

Edit `apps/web/.env.local` with your values:

```env
# Firebase (client-side)
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=

# Razorpay (test key, public)
NEXT_PUBLIC_RAZORPAY_KEY_ID=

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000

# Google Calendar OAuth (server-side only)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Groq AI (server-side only)
GROQ_API_KEY=
```

### 6. Run Locally

```bash
# Start Next.js dev server
cd apps/web && npm run dev

# In a separate terminal — start Firebase emulators (optional)
firebase emulators:start
```

Open [http://localhost:3000](http://localhost:3000).

---

## Deployment (Firebase App Hosting)

Firebase App Hosting natively supports Next.js with SSR and API routes.

**Requirements:** Firebase Blaze (pay-as-you-go) plan.

```bash
# Store server-side secrets
firebase apphosting:secrets:set google-client-id
firebase apphosting:secrets:set google-client-secret
firebase apphosting:secrets:set groq-api-key

# Grant service account access
firebase apphosting:secrets:grantaccess google-client-id,google-client-secret,groq-api-key

# Create backend (connects to your GitHub repo)
firebase apphosting:backends:create

# Deploy Firestore rules
firebase deploy --only firestore:rules,firestore:indexes

# Deploy Cloud Functions
firebase deploy --only functions
```

Once the backend is created, every push to `master` auto-deploys.

After deployment, add your live URL to:
- Firebase Auth → Authorized Domains
- Google Cloud Console → OAuth Redirect URIs

---

## Firestore Data Model

```
users/{uid}
  ├── tasks/{taskId}        Task (title, dueDate, recurrence, priority, status...)
  ├── habits/{habitId}      Habit (title, completions[], streak, color...)
  ├── timeLogs/{logId}      TimeLog (date, category, minutes, note)
  └── aiUsage/{date}        AI usage counter (read-only for client)
```

### Task Schema

```typescript
{
  id: string;
  title: string;
  description?: string;
  dueDate?: string;          // "YYYY-MM-DD"
  startTime?: string;        // "HH:MM"
  endTime?: string;          // "HH:MM"
  priority: 1 | 2 | 3 | 4 | 5;
  status: 'todo' | 'in-progress' | 'done';
  recurrence: 'none' | 'daily' | 'alternate' | 'weekly' | 'monthly' | 'yearly';
  recurrenceEnd?: { type: 'until'; until: string };
  category?: 'mind' | 'body' | 'soul' | 'work';
  estimatedMinutes?: number;
  googleEventId?: string;    // set when synced from Google Calendar
}
```

---

## Pro Features

| Feature | Free | Pro |
|---------|------|-----|
| Day view | ✅ | ✅ |
| Week view | ✅ | ✅ |
| Month view | ❌ | ✅ |
| AI Helper (task generation) | 3/day | 20/day |
| Habit streaks | ❌ | ✅ |
| Habit history heatmap | ❌ | ✅ |

Pro subscription is managed via Razorpay. Upgrade at `/upgrade`.

---

## License

MIT
