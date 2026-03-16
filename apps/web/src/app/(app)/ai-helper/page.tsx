import type { Metadata } from 'next';
import { AIHelperView } from '@/components/ai/AIHelperView';

export const metadata: Metadata = { title: 'AI Helper' };

export default function AIHelperPage() {
  return <AIHelperView />;
}
