'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { usePlannerStore } from '@/lib/store';
import { canUse } from 'shared/utils/gates';
import { cn } from '@/lib/utils';
import {
  LayoutDashboard,
  CalendarDays,
  CalendarRange,
  CalendarCheck2,
  Calendar,
  Flame,
  Settings,
  Zap,
  LogOut,
  ChevronRight,
  Sparkles,
  Menu,
  X,
} from 'lucide-react';
import { FloatingTimer } from '@/components/planner/FloatingTimer';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, gate: null },
  { href: '/planner/day', label: 'Day', icon: CalendarDays, gate: null },
  { href: '/planner/week', label: 'Week', icon: CalendarRange, gate: null },
  { href: '/planner/month', label: 'Month', icon: CalendarCheck2, gate: 'monthlyView' as const },
  { href: '/planner/year', label: 'Year', icon: Calendar, gate: 'yearlyView' as const },
  { href: '/habits', label: 'Habits', icon: Flame, gate: null },
  { href: '/ai-helper', label: 'AI Helper', icon: Sparkles, gate: null },
  { href: '/settings', label: 'Settings', icon: Settings, gate: null },
];

// Subset shown in the mobile bottom bar
const BOTTOM_NAV = [
  { href: '/dashboard', label: 'Home', icon: LayoutDashboard },
  { href: '/planner/day', label: 'Day', icon: CalendarDays },
  { href: '/habits', label: 'Habits', icon: Flame },
  { href: '/ai-helper', label: 'AI', icon: Sparkles },
  { href: '/settings', label: 'Settings', icon: Settings },
];

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const user = usePlannerStore((s) => s.user);
  const subscription = usePlannerStore((s) => s.subscription());
  const [drawerOpen, setDrawerOpen] = useState(false);

  async function handleSignOut() {
    await signOut(auth);
  }

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="flex h-16 items-center gap-2 border-b border-slate-200 px-4 dark:border-slate-800">
        <Zap className="h-6 w-6 text-brand-500" />
        <span className="text-lg font-bold tracking-tight">Vibe Planner</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
        {NAV_ITEMS.map(({ href, label, icon: Icon, gate }) => {
          const locked = gate !== null && !canUse(gate, subscription);
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              onClick={() => setDrawerOpen(false)}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                active
                  ? 'bg-brand-50 text-brand-700 dark:bg-brand-950 dark:text-brand-300'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800',
                locked && 'opacity-60'
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              <span className="flex-1">{label}</span>
              {locked && <ChevronRight className="h-3 w-3 opacity-50" />}
            </Link>
          );
        })}
      </nav>

      {/* Upgrade banner for free users */}
      {subscription.plan === 'free' && (
        <div className="m-3 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 p-3 text-white">
          <p className="text-xs font-semibold">Upgrade to Pro</p>
          <p className="mt-0.5 text-xs opacity-80">Unlock all features for $5/mo</p>
          <Link
            href="/upgrade"
            onClick={() => setDrawerOpen(false)}
            className="mt-2 block rounded-lg bg-white/20 py-1.5 text-center text-xs font-semibold hover:bg-white/30"
          >
            Upgrade
          </Link>
        </div>
      )}

      {/* User */}
      <div className="flex items-center gap-3 border-t border-slate-200 p-4 dark:border-slate-800">
        {user?.photoURL ? (
          <img
            src={user.photoURL}
            alt={user.displayName}
            className="h-8 w-8 rounded-full object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-sm font-bold text-brand-700">
            {user?.displayName?.[0] ?? '?'}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-medium">{user?.displayName}</p>
          <p className="truncate text-xs text-slate-400 capitalize">{subscription.plan}</p>
        </div>
        <button
          onClick={handleSignOut}
          className="rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
          title="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 dark:bg-slate-950">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-60 flex-shrink-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
        <SidebarContent />
      </aside>

      {/* Mobile drawer overlay */}
      {drawerOpen && (
        <div
          className="fixed inset-0 z-40 md:hidden"
          onClick={() => setDrawerOpen(false)}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40" />
          {/* Drawer */}
          <aside
            className="absolute left-0 top-0 bottom-0 flex w-72 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-3 rounded-lg p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <X className="h-5 w-5" />
            </button>
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Content column */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Mobile top bar */}
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:hidden dark:border-slate-800 dark:bg-slate-900">
          <button
            onClick={() => setDrawerOpen(true)}
            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="flex items-center gap-1.5">
            <Zap className="h-5 w-5 text-brand-500" />
            <span className="text-base font-bold tracking-tight">Vibe Planner</span>
          </div>
          {/* Spacer to centre-balance the title */}
          <div className="w-9" />
        </header>

        {/* Main content — extra bottom padding on mobile to clear bottom nav */}
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">{children}</main>
      </div>

      {/* Mobile bottom navigation */}
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-slate-200 bg-white md:hidden dark:border-slate-800 dark:bg-slate-900">
        {BOTTOM_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition',
                active
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
              )}
            >
              <Icon className="h-5 w-5" />
              {label}
            </Link>
          );
        })}
      </nav>

      {/* Floating timer — visible from any page when a timer is running */}
      <FloatingTimer />
    </div>
  );
}
