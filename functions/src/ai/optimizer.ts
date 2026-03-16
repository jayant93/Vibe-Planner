import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { defineSecret } from 'firebase-functions/params';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getModelChain, buildScheduleOptimizerPrompt } from 'shared/ai/router';
import type { OptimizeScheduleRequest, OptimizeScheduleResponse } from 'shared/types';
import { FREE_TIER } from 'shared/utils/gates';

// ─── Secrets ─────────────────────────────────────────────────────────────────

const GROQ_API_KEY = defineSecret('GROQ_API_KEY');
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');
const MISTRAL_API_KEY = defineSecret('MISTRAL_API_KEY');
const CEREBRAS_API_KEY = defineSecret('CEREBRAS_API_KEY');
const CLAUDE_API_KEY = defineSecret('CLAUDE_API_KEY');

// ─── Function ─────────────────────────────────────────────────────────────────

export const optimizeSchedule = onCall(
  {
    secrets: [GROQ_API_KEY, GEMINI_API_KEY, MISTRAL_API_KEY, CEREBRAS_API_KEY, CLAUDE_API_KEY],
    memory: '512MiB',
  },
  async (request) => {
    const uid = request.auth?.uid;
    if (!uid) throw new HttpsError('unauthenticated', 'Authentication required');

    const db = getFirestore();
    const userSnap = await db.doc(`users/${uid}`).get();
    if (!userSnap.exists) throw new HttpsError('not-found', 'User not found');

    const userData = userSnap.data() as { subscription?: { plan?: string } };
    const plan = (userData.subscription?.plan ?? 'free') as 'free' | 'pro';

    // Rate-limit free users
    if (plan === 'free') {
      const today = new Date().toISOString().slice(0, 10);
      const usageRef = db.doc(`users/${uid}/aiUsage/${today}`);
      const usageSnap = await usageRef.get();
      const count = (usageSnap.data() as { count?: number } | undefined)?.count ?? 0;

      if (count >= FREE_TIER.AI_CALLS_PER_DAY) {
        throw new HttpsError(
          'resource-exhausted',
          `Daily AI limit reached (${FREE_TIER.AI_CALLS_PER_DAY}/day on free plan).`
        );
      }

      // Increment usage (only Cloud Functions write this)
      await usageRef.set({ count: FieldValue.increment(1) }, { merge: true });
    }

    const payload = request.data as OptimizeScheduleRequest;
    const prompt = buildScheduleOptimizerPrompt(payload);
    const modelChain = getModelChain(plan);

    // Try each model in the fallback chain
    let lastError: Error | null = null;
    for (const model of modelChain) {
      try {
        const result = await callModel(model.provider, model.modelId, prompt, {
          groqKey: GROQ_API_KEY.value(),
          geminiKey: GEMINI_API_KEY.value(),
          mistralKey: MISTRAL_API_KEY.value(),
          cerebrasKey: CEREBRAS_API_KEY.value(),
          claudeKey: CLAUDE_API_KEY.value(),
        });
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        // 429 = rate limited, try next model
        if (!isRateLimitError(err)) throw err;
        console.warn(`[AI Router] ${model.provider}/${model.modelId} rate-limited, trying next...`);
      }
    }

    throw new HttpsError(
      'unavailable',
      `All AI models unavailable: ${lastError?.message ?? 'Unknown error'}`
    );
  }
);

// ─── Model callers ─────────────────────────────────────────────────────────────

interface ApiKeys {
  groqKey: string;
  geminiKey: string;
  mistralKey: string;
  cerebrasKey: string;
  claudeKey: string;
}

async function callModel(
  provider: string,
  modelId: string,
  prompt: string,
  keys: ApiKeys
): Promise<OptimizeScheduleResponse> {
  switch (provider) {
    case 'groq':
      return callGroq(modelId, prompt, keys.groqKey);
    case 'gemini':
      return callGemini(modelId, prompt, keys.geminiKey);
    case 'mistral':
      return callMistral(modelId, prompt, keys.mistralKey);
    case 'cerebras':
      return callCerebras(modelId, prompt, keys.cerebrasKey);
    case 'claude':
      return callClaude(modelId, prompt, keys.claudeKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

async function callGroq(modelId: string, prompt: string, apiKey: string): Promise<OptimizeScheduleResponse> {
  const { default: Groq } = await import('groq-sdk');
  const groq = new Groq({ apiKey });
  const completion = await groq.chat.completions.create({
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    response_format: { type: 'json_object' },
    max_tokens: 2048,
    temperature: 0.3,
  });
  const content = completion.choices[0]?.message.content ?? '{}';
  return JSON.parse(content) as OptimizeScheduleResponse;
}

async function callGemini(modelId: string, prompt: string, apiKey: string): Promise<OptimizeScheduleResponse> {
  const { GoogleGenerativeAI } = await import('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: modelId });
  const result = await model.generateContent(prompt + '\n\nRespond with valid JSON only.');
  const text = result.response.text();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Gemini response');
  return JSON.parse(jsonMatch[0]) as OptimizeScheduleResponse;
}

async function callMistral(modelId: string, prompt: string, apiKey: string): Promise<OptimizeScheduleResponse> {
  const { Mistral } = await import('@mistralai/mistralai');
  const client = new Mistral({ apiKey });
  const result = await client.chat.complete({
    model: modelId,
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });
  const content = result.choices?.[0]?.message.content ?? '{}';
  const text = typeof content === 'string' ? content : JSON.stringify(content);
  return JSON.parse(text) as OptimizeScheduleResponse;
}

async function callCerebras(modelId: string, prompt: string, apiKey: string): Promise<OptimizeScheduleResponse> {
  // Cerebras uses OpenAI-compatible API
  const res = await fetch('https://api.cerebras.ai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: prompt }],
      response_format: { type: 'json_object' },
      max_tokens: 4096,
      temperature: 0.2,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Cerebras error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { choices: Array<{ message: { content: string } }> };
  return JSON.parse(data.choices[0]?.message.content ?? '{}') as OptimizeScheduleResponse;
}

async function callClaude(modelId: string, prompt: string, apiKey: string): Promise<OptimizeScheduleResponse> {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: modelId,
      max_tokens: 4096,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Claude error ${res.status}: ${err}`);
  }
  const data = (await res.json()) as { content: Array<{ type: string; text: string }> };
  const text = data.content.find((c) => c.type === 'text')?.text ?? '{}';
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('No JSON in Claude response');
  return JSON.parse(jsonMatch[0]) as OptimizeScheduleResponse;
}

function isRateLimitError(err: unknown): boolean {
  if (err instanceof Error) {
    return err.message.includes('429') || err.message.toLowerCase().includes('rate limit');
  }
  return false;
}
