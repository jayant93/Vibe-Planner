import type { Metadata } from 'next';
import { WeekView } from '@/components/planner/WeekView';

export const metadata: Metadata = { title: 'Week Planner' };

export default function WeekPlannerPage() {
  return <WeekView />;
}
