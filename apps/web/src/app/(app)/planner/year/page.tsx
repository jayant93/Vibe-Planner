import type { Metadata } from 'next';
import { YearView } from '@/components/planner/YearView';

export const metadata: Metadata = { title: 'Year Planner' };

export default function YearPlannerPage() {
  return <YearView />;
}
