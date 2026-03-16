import type { Plan, Task, UserPreferences } from '../types/index.js';

// ─── Model Configs ────────────────────────────────────────────────────────────

export interface AIModelConfig {
  provider: 'groq' | 'gemini' | 'mistral' | 'cerebras' | 'claude';
  modelId: string;
  maxTokens: number;
  temperature: number;
}

export const FREE_MODEL_CHAIN: AIModelConfig[] = [
  {
    provider: 'groq',
    modelId: 'llama-3.1-8b-instant',
    maxTokens: 2048,
    temperature: 0.3,
  },
  {
    provider: 'gemini',
    modelId: 'gemini-2.0-flash',
    maxTokens: 2048,
    temperature: 0.3,
  },
  {
    provider: 'mistral',
    modelId: 'mistral-small-latest',
    maxTokens: 2048,
    temperature: 0.3,
  },
];

export const PRO_MODEL_CHAIN: AIModelConfig[] = [
  {
    provider: 'gemini',
    modelId: 'gemini-1.5-pro',
    maxTokens: 4096,
    temperature: 0.2,
  },
  {
    provider: 'cerebras',
    modelId: 'llama3.1-70b',
    maxTokens: 4096,
    temperature: 0.2,
  },
  {
    provider: 'claude',
    modelId: 'claude-sonnet-4-6',
    maxTokens: 4096,
    temperature: 0.2,
  },
];

export function getModelChain(plan: Plan): AIModelConfig[] {
  return plan === 'pro' ? PRO_MODEL_CHAIN : FREE_MODEL_CHAIN;
}

// ─── Prompt Builders ──────────────────────────────────────────────────────────

export interface ScheduleOptimizerInput {
  tasks: Task[];
  availableSlots: Array<{ start: string; end: string }>;
  preferences: UserPreferences;
  date: string;
}

export function buildScheduleOptimizerPrompt(input: ScheduleOptimizerInput): string {
  const { tasks, availableSlots, preferences, date } = input;

  const taskList = tasks
    .filter((t) => t.status !== 'done')
    .map(
      (t) =>
        `- [ID: ${t.id}] "${t.title}" | Priority: ${t.priority}/5 | Due: ${t.dueDate ?? 'flexible'} | Status: ${t.status}`
    )
    .join('\n');

  const slotList = availableSlots
    .map((s) => `  ${s.start} – ${s.end}`)
    .join('\n');

  return `You are a productivity scheduling assistant. Your job is to optimally schedule tasks into available time slots.

## Context
- Date: ${date}
- Work hours: ${preferences.workStartTime} – ${preferences.workEndTime}
- Timezone: assumed local

## Tasks to Schedule
${taskList || 'No pending tasks.'}

## Available Time Slots
${slotList || 'No available slots.'}

## Instructions
1. Assign each task a time block from the available slots (do not overlap)
2. Prioritize high-priority tasks (5 = highest) and tasks due soonest
3. Assign an aiScore (0–100) to each task based on urgency × priority
4. Leave buffer time between tasks when possible
5. Provide 2-3 scheduling suggestions

## Response Format (strict JSON)
{
  "scheduledTasks": [
    {
      "taskId": "string",
      "timeBlock": { "start": "HH:MM", "end": "HH:MM", "locked": false },
      "aiScore": 85,
      "reasoning": "High priority, due today"
    }
  ],
  "suggestions": ["string"]
}`;
}
