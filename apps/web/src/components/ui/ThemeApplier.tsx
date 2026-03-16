'use client';

import { useEffect } from 'react';
import { usePlannerStore } from '@/lib/store';

/**
 * Reads the user's accent color preference and applies it as
 * a `data-theme` attribute on <html> so CSS variables take effect.
 * Also applies light/dark class.
 */
export function ThemeApplier() {
  const user = usePlannerStore((s) => s.user);

  useEffect(() => {
    const theme = user?.preferences?.theme ?? 'system';
    const accent = user?.preferences?.accentColor ?? 'blue';

    const html = document.documentElement;

    // Apply dark/light class
    if (theme === 'dark') {
      html.classList.add('dark');
    } else if (theme === 'light') {
      html.classList.remove('dark');
    } else {
      // system
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      html.classList.toggle('dark', prefersDark);
    }

    // Apply accent color
    html.setAttribute('data-theme', accent);
  }, [user?.preferences?.theme, user?.preferences?.accentColor]);

  return null;
}
