import type { Metadata } from 'next';
import { DayView } from '@/components/planner/DayView';

export const metadata: Metadata = { title: 'Day Planner' };

export default function DayPlannerPage() {
  return <DayView />;
}
