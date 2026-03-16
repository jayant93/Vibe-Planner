import type { Metadata } from 'next';
import { UpgradeView } from '@/components/ui/UpgradeView';

export const metadata: Metadata = { title: 'Upgrade to Pro' };

export default function UpgradePage() {
  return <UpgradeView />;
}
