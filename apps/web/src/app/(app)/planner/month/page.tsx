import type { Metadata } from 'next';
import { MonthView } from '@/components/planner/MonthView';

export const metadata: Metadata = { title: 'Month Planner' };

export default function MonthPlannerPage() {
  return <MonthView />;
}
