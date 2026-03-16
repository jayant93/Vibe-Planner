import type { Metadata } from 'next';
import { Suspense } from 'react';
import { LoginForm } from '@/components/ui/LoginForm';

export const metadata: Metadata = { title: 'Sign In' };

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-50 to-brand-50 px-4 dark:from-slate-950 dark:to-brand-950">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white">
            Vibe Planner
          </h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            AI-powered productivity, beautifully organized.
          </p>
        </div>
        {/* Suspense required for useSearchParams() in Next.js 14 */}
        <Suspense fallback={<div className="h-24 rounded-2xl bg-slate-100 animate-pulse dark:bg-slate-800" />}>
          <LoginForm />
        </Suspense>
      </div>
    </div>
  );
}
