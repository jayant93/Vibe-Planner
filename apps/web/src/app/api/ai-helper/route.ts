import { NextResponse } from 'next/server';

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export interface AISuggestedTask {
  title: string;
  description: string;        // always present — 1-2 sentences with context & expected outcome
  priority: 1 | 2 | 3 | 4 | 5;
  estimatedMinutes?: number;  // how long this task is expected to take
  dueDate?: string;           // YYYY-MM-DD
  startTime?: string;         // HH:MM
  endTime?: string;           // HH:MM
  recurrence: 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';
  category?: string;          // "mind" | "body" | "soul" | "work"
}

export async function POST(req: Request) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: 'AI service not configured' }, { status: 500 });
  }

  const { text, today } = (await req.json()) as { text: string; today: string };

  // Build week context so AI can spread tasks correctly
  const todayDate = new Date(today + 'T00:00:00');
  const dayOfWeek = todayDate.getDay(); // 0=Sun
  const weekDays: string[] = [];
  const weekDayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
  for (let i = 0; i < 7; i++) {
    const d = new Date(todayDate);
    d.setDate(todayDate.getDate() - dayOfWeek + i);
    weekDays.push(`${weekDayNames[i]} = ${d.toISOString().slice(0, 10)}`);
  }

  if (!text?.trim()) {
    return NextResponse.json({ error: 'No text provided' }, { status: 400 });
  }

  const systemPrompt = `You are an expert productivity assistant for a personal planner app.
Today is ${weekDayNames[dayOfWeek]}, ${today}.
This week's dates: ${weekDays.join(', ')}.

Your job: extract every actionable task from the user's text and return them as a rich JSON array.
Return ONLY a valid JSON array — no markdown, no explanation, no extra text.

Rules:
1. Break compound goals into individual, concrete tasks (e.g. "launch a campaign" → research, write copy, design assets, schedule, review).
2. Every task MUST have a non-empty "description" — write 1-2 sentences explaining WHAT to do, WHY it matters, and the expected OUTCOME or deliverable.
3. Infer dates from relative phrases relative to today (${today}):
   - "tomorrow" = ${today} + 1 day
   - "this week" / "whole week" = spread tasks evenly Mon–Sun of the current week — DO NOT assign the same dueDate to more than 2 tasks; distribute across different days
   - "next week" = spread across next Monday–Sunday
   - "every day this week" = one task per day Mon–Sun, each with its own unique dueDate
   - "Monday", "Tuesday" etc. = the upcoming occurrence of that weekday
   - If no date is mentioned, omit dueDate entirely (do not default to today)
4. Infer priority from urgency/impact: 5=critical/urgent, 4=high, 3=medium, 2=low, 1=someday.
5. Estimate realistic time in minutes for "estimatedMinutes".
6. Assign a "category": one of "mind", "body", "soul", "work".
   - mind = reading, writing, studying, learning, journaling, creative thinking
   - body = exercise, gym, running, sports, sleep, nutrition, physical health
   - soul = meditation, family time, social connection, self-care, hobbies, gratitude
   - work = professional tasks, meetings, emails, projects, career-related activities

Each task object fields:
- title: string — concise verb-first label (max 8 words), e.g. "Draft Q2 marketing report"
- description: string — REQUIRED, 1-2 sentences with context and expected outcome
- priority: 1–5
- estimatedMinutes: number (realistic estimate)
- dueDate: "YYYY-MM-DD" or omit
- startTime: "HH:MM" or omit (only if a time was mentioned)
- endTime: "HH:MM" or omit
- recurrence: "none" | "daily" | "weekly" | "monthly" | "yearly"
- category: "mind" | "body" | "soul" | "work"

Example:
[
  {
    "title": "Prepare client presentation slides",
    "description": "Create a 10-slide deck covering Q2 results, market analysis, and next quarter roadmap for the Thursday client review. Ensure all charts are updated with latest data from the analytics dashboard.",
    "priority": 4,
    "estimatedMinutes": 90,
    "dueDate": "${today}",
    "startTime": "09:00",
    "endTime": "10:30",
    "recurrence": "none",
    "category": "work"
  }
]`;

  const body = JSON.stringify({
    model: MODEL,
    temperature: 0,
    stream: false,
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: text.trim() },
    ],
  });

  const response = await fetch(GROQ_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body,
  });

  if (!response.ok) {
    const err = await response.text();
    return NextResponse.json({ error: `AI API error: ${err}` }, { status: 502 });
  }

  const data = (await response.json()) as {
    choices: Array<{ message: { content: string } }>;
  };

  const content = data.choices[0]?.message?.content ?? '[]';

  let tasks: AISuggestedTask[];
  try {
    // Strip any accidental markdown code fences
    const clean = content.replace(/```json|```/g, '').trim();
    tasks = JSON.parse(clean) as AISuggestedTask[];
  } catch {
    return NextResponse.json({ error: 'Failed to parse AI response', raw: content }, { status: 502 });
  }

  return NextResponse.json({ tasks });
}
