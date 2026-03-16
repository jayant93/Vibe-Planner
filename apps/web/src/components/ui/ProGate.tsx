'use client';

import Link from 'next/link';
import { Lock } from 'lucide-react';
import type { GateKey } from 'shared/utils/gates';
import { getUpgradeReason } from 'shared/utils/gates';
import { cn } from '@/lib/utils';

interface ProGateProps {
  feature: GateKey;
  className?: string;
}

export function ProGate({ feature, className }: ProGateProps) {
  const reason = getUpgradeReason(feature);

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center gap-4 rounded-2xl border border-dashed border-brand-300 bg-brand-50 p-10 text-center dark:border-brand-700 dark:bg-brand-950',
        className
      )}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-brand-100 dark:bg-brand-900">
        <Lock className="h-6 w-6 text-brand-600 dark:text-brand-400" />
      </div>
      <div>
        <p className="text-sm font-medium text-slate-900 dark:text-slate-100">Pro Feature</p>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{reason}</p>
      </div>
      <Link
        href="/upgrade"
        className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500"
      >
        Upgrade to Pro — $5/mo
      </Link>
    </div>
  );
}
