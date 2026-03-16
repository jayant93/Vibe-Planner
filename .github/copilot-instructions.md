# Vibe Planner — Copilot Agent Instructions

You are an expert full-stack developer working on **Vibe Planner**, a cross-platform productivity app (Next.js web + React Native mobile) with Firebase backend, Stripe billing, Google Calendar sync, and AI-powered scheduling.

---

## Project Overview

A freemium daily/weekly/monthly/yearly planner with:
- **Free tier**: Daily + Weekly views, unlimited tasks, 3 habits (no streaks), 5 AI calls/day
- **Pro tier ($X/mo)**: All views, unlimited everything, Google Calendar 2-way sync, unlimited AI, streaks, export

---

## Monorepo Structure

```
vibe-planner/
├── apps/
│   ├── web/                        # Next.js 14 (App Router)
│   │   ├── app/
│   │   │   ├── (auth)/login/       # Google Sign-In page
│   │   │   ├── (app)/
│   │   │   │   ├── dashboard/      # Today's overview
│   │   │   │   ├── planner/
│   │   │   │   │   ├── day/        # Free + Pro
│   │   │   │   │   ├── week/       # Free + Pro
│   │   │   │   │   ├── month/      # Pro only
│   │   │   │   │   └── year/       # Pro only
│   │   │   │   ├── habits/         # Habit tracker
│   │   │   │   ├── settings/       # User prefs + billing portal
│   │   │   │   └── upgrade/        # Pricing + Stripe checkout
│   │   │   └── api/
│   │   │       ├── ai/optimize/    # AI schedule optimizer endpoint
│   │   │       ├── stripe/webhook/ # Stripe webhook handler
│   │   │       └── gcal/           # GCal OAuth callback
│   │   ├── components/
│   │   │   ├── ui/                 # Shared UI (buttons, modals, badges)
│   │   │   ├── planner/            # Calendar components
│   │   │   ├── habits/             # Habit components
│   │   │   └── ai/                 # AI feature components
│   │   └── lib/
│   │       ├── firebase.ts         # Firebase client + callable fns
│   │       └── store.ts            # Zustand global store
│   │
│   └── mobile/                     # React Native + Expo
│       ├── app/
│       │   ├── (auth)/             # Login screen
│       │   ├── (tabs)/
│       │   │   ├── planner/        # Day/Week planner
│       │   │   ├── habits/         # Habit tracker
│       │   │   └── settings/       # Settings + upgrade
│       │   └── upgrade/            # Paywall screen
│       └── components/
│
├── packages/
│   └── shared/                     # Shared between web + mobile
│       ├── types/index.ts          # All TypeScript interfaces
│       ├── utils/gates.ts          # Feature gate checks
│       └── ai/router.ts            # AI model configs + prompt builders
│
├── functions/                      # Firebase Cloud Functions
│   └── src/
│       ├── ai/optimizer.ts         # AI router (Groq/Gemini/Mistral/Cerebras/Claude)
│       ├── stripe/webhooks.ts      # Stripe billing + subscription management
│       ├── gcal/sync.ts            # Google Calendar 2-way sync
│       └── scheduled/streaks.ts   # Daily habit streak cron
│
├── firebase.json
├── firestore.rules
├── turbo.json
└── package.json
```

---

## Tech Stack

| Layer | Technology |
|---|---|
| Web framework | Next.js 14 (App Router) |
| Mobile | React Native + Expo |
| Styling (web) | Tailwind CSS |
| Styling (mobile) | NativeWind |
| State management | Zustand |
| Calendar UI | FullCalendar.js (web) |
| Auth | Firebase Auth (Google Sign-In) |
| Database | Firestore |
| File storage | Firebase Storage |
| Backend logic | Firebase Cloud Functions (v2) |
| Payments | Stripe (subscriptions + billing portal) |
| Calendar sync | Google Calendar API v3 |
| AI (free tier) | Groq → Gemini Flash → Mistral (fallback chain) |
| AI (pro tier) | Gemini Pro → Cerebras → Claude Sonnet (fallback chain) |
| Monorepo | Turborepo |
| Language | TypeScript everywhere |

---

## Core Types (packages/shared/types/index.ts)

```typescript
type Plan = 'free' | 'pro';

interface Subscription {
  plan: Plan;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  currentPeriodEnd?: Date;
  cancelAtPeriodEnd?: boolean;
}

interface Task {
  id: string;
  userId: string;
  title: string;
  description?: string;
  priority: 1 | 2 | 3 | 4 | 5;
  status: 'todo' | 'in-progress' | 'done';
  dueDate?: string;           // ISO date
  startTime?: string;
  endTime?: string;
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  googleEventId?: string;
  timeBlock?: { start: string; end: string; locked: boolean };
  aiScore?: number;
  createdAt: Date;
  updatedAt: Date;
}

interface Habit {
  id: string;
  userId: string;
  title: string;
  targetFrequency: 'daily' | 'weekly';
  streak: { current: number; longest: number; lastCompleted?: string };
  completions: string[];      // ISO date strings
  createdAt: Date;
}

interface UserProfile {
  uid: string;
  email: string;
  displayName: string;
  timezone: string;
  subscription: Subscription;
  gcalLinked: boolean;
  preferences: {
    workStartTime: string;    // "09:00"
    workEndTime: string;      // "18:00"
    theme: 'light' | 'dark' | 'system';
    weekStartsOn: 0 | 1;
  };
}
```

---

## Feature Gates (packages/shared/utils/gates.ts)

Always use `canUse()` before rendering gated features. Never hardcode plan checks inline.

```typescript
import { canUse, getUpgradeReason } from 'shared/utils/gates';

// Usage
if (!canUse('gcalSync', subscription)) {
  return <UpgradePrompt reason={getUpgradeReason('gcalSync')} />;
}
```

**Gate keys:**
- `monthlyView` — Pro only
- `yearlyView` — Pro only
- `gcalSync` — Pro only
- `aiUnlimited` — Pro only (free gets 5/day)
- `timeBlockSuggestions` — Pro only
- `smartPrioritization` — Pro only
- `habitStreaks` — Pro only
- `unlimitedHabits` — Pro only (free gets 3)
- `exportData` — Pro only
- `offlineMode` — Pro only

---

## Firestore Data Model

```
users/{uid}
  ├── profile fields (email, displayName, timezone, preferences...)
  ├── subscription: { plan, stripeCustomerId, stripeSubscriptionId, currentPeriodEnd }
  ├── gcalLinked: boolean
  ├── gcalTokens: { accessToken, refreshToken, expiresAt }
  ├── tasks/{taskId}           → Task
  ├── habits/{habitId}         → Habit
  └── aiUsage/{YYYY-MM-DD}     → { count: number } (written by Cloud Functions only)
```

**Rules:**
- `subscription` field is **read-only from client** — only Cloud Functions (Stripe webhook) can write it
- `aiUsage` is **write-only by Cloud Functions** — client can read to show usage count
- All user data is strictly scoped to `request.auth.uid == uid`

---

## AI Model Routing

Cloud Function `optimizeSchedule` routes to different models based on plan:

```
Free users  → Groq (llama-3.1-8b-instant) → Gemini Flash 2.0 → Mistral Small
Pro users   → Gemini 1.5 Pro → Cerebras (llama3.1-70b) → Claude Sonnet
```

- Free users: **5 AI calls/day** (tracked in `aiUsage/{date}`)
- Rate-limited (HTTP 429) → automatically try next model in chain
- All keys stored in **Firebase Secret Manager**, never in client

---

## Environment Variables

### Web app (.env.local)
```
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### Firebase Functions (Secret Manager)
```
GROQ_API_KEY
GEMINI_API_KEY
MISTRAL_API_KEY
CEREBRAS_API_KEY
CLAUDE_API_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_PRO_PRICE_ID
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
APP_URL
```

---

## Coding Conventions

### General
- **TypeScript strict mode** everywhere — no `any`, no `@ts-ignore`
- All async functions use `try/catch` with typed errors
- Prefer `const` over `let`; never `var`
- Use named exports, not default exports (except Next.js pages/layouts)

### React / Next.js
- Use `'use client'` only when necessary (interactivity, hooks, browser APIs)
- Server Components are the default — fetch data server-side where possible
- Use `React.Suspense` + loading skeletons for async boundaries
- No prop drilling — use Zustand store for cross-component state
- Tailwind only — no inline styles, no CSS modules

### Components
- One component per file
- Props interface named `{ComponentName}Props`
- Gate all Pro features at render time with `canUse()`:

```tsx
// ✅ Correct pattern
function MonthView() {
  const subscription = usePlannerStore(s => s.subscription());
  if (!canUse('monthlyView', subscription)) {
    return <ProGate feature="monthlyView" />;
  }
  return <FullCalendar ... />;
}
```

### Firebase
- Always use `onSnapshot` for real-time listeners in components
- Clean up listeners in `useEffect` return
- Use `serverTimestamp()` for `createdAt`/`updatedAt`
- Use `merge: true` in `setDoc` to avoid overwriting

### Cloud Functions
- All callable functions check `req.auth?.uid` first
- Stripe webhook handler verifies signature before processing
- GCal functions check `isPro()` before executing
- Use Firebase Secret Manager — never `process.env` directly in functions (use `defineSecret`)

### Error Handling
- Cloud Functions throw `HttpsError` with appropriate code
- Client wraps callable calls in try/catch
- Show toast notifications for errors, not console.log
- AI failures fallback gracefully — never block the UI

---

## Common Patterns

### Checking subscription in a component
```typescript
const subscription = usePlannerStore(s => s.subscription());
const isPro = usePlannerStore(s => s.isPro());
```

### Calling an AI Cloud Function
```typescript
import { callOptimizeSchedule } from '@/lib/firebase';

const result = await callOptimizeSchedule({ tasks, availableSlots, preferences, date });
```

### Triggering Stripe checkout
```typescript
import { callCreateCheckout } from '@/lib/firebase';

const { data } = await callCreateCheckout({});
window.location.href = data.url; // Stripe hosted checkout
```

### Gating a route (middleware)
```typescript
// middleware.ts
export function middleware(request: NextRequest) {
  const isPro = // check cookie/session
  if (request.nextUrl.pathname.startsWith('/planner/month') && !isPro) {
    return NextResponse.redirect(new URL('/upgrade', request.url));
  }
}
```

---

## Key Files Reference

| File | Purpose |
|---|---|
| `packages/shared/types/index.ts` | Source of truth for all types |
| `packages/shared/utils/gates.ts` | All feature gate logic |
| `packages/shared/ai/router.ts` | AI model configs + prompt builders |
| `apps/web/lib/firebase.ts` | Firebase client + all callable functions |
| `apps/web/lib/store.ts` | Zustand store (auth, tasks, habits, UI) |
| `apps/web/components/ui/AuthProvider.tsx` | Auth listener + user doc creation |
| `functions/src/ai/optimizer.ts` | AI router with model fallback chain |
| `functions/src/stripe/webhooks.ts` | Full Stripe lifecycle handling |
| `functions/src/gcal/sync.ts` | Google Calendar OAuth + sync |
| `functions/src/scheduled/streaks.ts` | Daily habit streak cron |
| `firestore.rules` | Security rules (subscription write-protected) |

---

## Do Not

- ❌ Never write `subscription.plan === 'pro'` inline — always use `canUse()` from gates.ts
- ❌ Never expose API keys in client-side code
- ❌ Never let clients write to `aiUsage` or `subscription` collections directly
- ❌ Never skip Stripe webhook signature verification
- ❌ Never use `any` type
- ❌ Never call AI models directly from the client — always go through Cloud Functions
- ❌ Never use `useEffect` for data that can be fetched server-side in Next.js
