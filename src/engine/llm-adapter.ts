import { GoogleGenerativeAI } from '@google/generative-ai';
import { createLogger } from '../logger.js';
import {
  VALID_SIDES,
  VALID_ACTIVITIES,
  VALID_LOCATIONS,
  VALID_DESCRIPTIONS,
} from '../types/controlled-vocabulary.js';
import { ExtractedEntitiesSchema } from '../types/entities.js';
import type { ExtractedEntities } from '../types/entities.js';
import type { ConversationMessage } from '../types/messages.js';

const log = createLogger('llm-adapter');

// --- Token usage tracking ---

export interface TokenUsage {
  prompt: number;
  completion: number;
}

// --- LLMAdapter interface ---

export interface LLMAdapter {
  extractEntities(
    userMessage: string,
    conversationHistory: ConversationMessage[],
  ): Promise<{ entities: ExtractedEntities; tokensUsed: TokenUsage }>;

  generateClarification(
    missingEntities: string[],
    context: ConversationMessage[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }>;

  generateWrapper(
    recommendation: Record<string, unknown>,
    context: ConversationMessage[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }>;

  suggestAlternatives(
    entities: ExtractedEntities,
    availableActivities: string[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }>;
}

// --- System prompts ---

const ENTITY_EXTRACTION_SYSTEM_PROMPT = `You are an entity extraction system for a knee assessment app. Your ONLY job is to extract structured entities from the user's message.

You MUST normalize the user's language into the controlled vocabulary below. Return ONLY a JSON object with these four fields. Set a field to null if the user did not mention it or if no valid mapping exists.

Do NOT provide medical advice or recommendations. Do NOT add any text outside the JSON object.

## Controlled Vocabulary

### symptom_side
Valid values: ${VALID_SIDES.join(', ')}

### triggering_activity
Valid values: ${VALID_ACTIVITIES.join(', ')}
Normalization examples:
- "going downstairs" / "walking down steps" / "descending stairs" → "stairs_down"
- "going upstairs" / "climbing stairs" → "stairs_up"
- "doing squats" / "squatting down" / "deep knee bends" → "squatting"
- "jogging" / "sprinting" → "running"
- "biking" / "spinning" / "on the bike" → "cycling"
- "getting up from a chair" / "standing up" → "sitting"

### symptom_location
Valid values: ${VALID_LOCATIONS.join(', ')}
Normalization examples:
- "front of knee" / "kneecap" / "on the kneecap" → "patella"
- "below the kneecap" / "under the kneecap" → "patellar_tendon"
- "above the kneecap" / "top of kneecap" → "supra_patellofemoral_joint"
- "inner knee" / "inside of knee" → "anteromedial_tibial_plateau"
- "outer knee" / "outside of knee" → "anterolateral_tibial_plateau"
- "back of knee" / "behind the knee" → "posteromedial_tibial_plateau"
- "upper inner kneecap" → "superomedial_patellofemoral_joint"
- "lower inner kneecap" → "inferomedial_patellofemoral_joint"

### symptom_description
Valid values: ${VALID_DESCRIPTIONS.join(', ')}
Normalization examples:
- "it clicks" / "clicking sound" → "clicking"
- "it pops" / "popping" → "popping"
- "it gives out" / "buckles" / "feels unstable" → "giving_way"
- "sore" / "achy" → "aching"
- "tight" / "feels tight" → "tightness"
- "swollen" / "puffy" / "inflamed" → "swelling"

## Output Format
Return ONLY valid JSON:
{"symptom_side": "left"|"right"|"both"|null, "triggering_activity": "<value>"|null, "symptom_location": "<value>"|null, "symptom_description": "<value>"|null}`;

const CLARIFICATION_SYSTEM_PROMPT = `You are a friendly assistant for a knee assessment app. The user has described their knee issue but some information is missing. Ask a brief, natural follow-up question to gather the missing details. Keep it conversational and empathetic. Do NOT provide medical advice or recommendations.`;

const WRAPPER_SYSTEM_PROMPT = `You are a friendly assistant for a knee assessment app. Wrap the given movement recommendation in conversational, encouraging language. Keep it brief (2-3 sentences). Do NOT add medical advice beyond what is provided in the recommendation.`;

const ALTERNATIVES_SYSTEM_PROMPT = `You are a friendly assistant for a knee assessment app. The user described an activity we don't have specific corrections for yet. Suggest they try one of the available activities instead. Be empathetic, brief, and conversational. Do NOT provide medical advice.`;

// --- Helpers ---

const NULL_ENTITIES: ExtractedEntities = {
  symptom_side: null,
  triggering_activity: null,
  symptom_location: null,
  symptom_description: null,
};

const ZERO_TOKENS: TokenUsage = { prompt: 0, completion: 0 };

function formatHistory(messages: ConversationMessage[]): string {
  return messages
    .map((m) => `${m.role}: ${m.content}`)
    .join('\n');
}

function extractJson(text: string): string {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) return fenced[1].trim();
  const braces = text.match(/\{[\s\S]*\}/);
  if (braces) return braces[0];
  return text.trim();
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`LLM request timed out after ${ms}ms`)), ms);
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    clearTimeout(timer!);
  }
}

async function withRetry<T>(fn: () => Promise<T>, retries: number, baseDelayMs: number): Promise<T> {
  let lastError: Error | undefined;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err as Error;
      if (attempt < retries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        log.warn(`LLM attempt ${attempt + 1} failed, retrying in ${delay}ms`, { error: lastError.message });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }
  throw lastError;
}

// --- Gemini Adapter ---

export class GeminiAdapter implements LLMAdapter {
  private model;

  constructor(apiKey: string) {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });
  }

  private async call(systemPrompt: string, userPrompt: string): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const result = await withTimeout(
      this.model.generateContent({
        systemInstruction: systemPrompt,
        contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
      }),
      5000,
    );

    const response = result.response;
    const text = response.text();
    const usage = response.usageMetadata;

    return {
      text,
      tokensUsed: {
        prompt: usage?.promptTokenCount ?? 0,
        completion: usage?.candidatesTokenCount ?? 0,
      },
    };
  }

  async extractEntities(
    userMessage: string,
    conversationHistory: ConversationMessage[],
  ): Promise<{ entities: ExtractedEntities; tokensUsed: TokenUsage }> {
    const historyText = conversationHistory.length > 0
      ? `\n\nConversation so far:\n${formatHistory(conversationHistory)}`
      : '';

    const prompt = `Extract entities from this message:${historyText}\n\nUser message: "${userMessage}"`;

    try {
      const { text, tokensUsed } = await withRetry(
        () => this.call(ENTITY_EXTRACTION_SYSTEM_PROMPT, prompt),
        1,
        1000,
      );

      const jsonStr = extractJson(text);
      const raw = JSON.parse(jsonStr);
      const parsed = ExtractedEntitiesSchema.safeParse(raw);

      if (!parsed.success) {
        log.warn('Entity extraction returned invalid shape, returning nulls', {
          raw: jsonStr,
          errors: parsed.error.flatten().fieldErrors,
        });
        return { entities: { ...NULL_ENTITIES }, tokensUsed };
      }

      return { entities: parsed.data, tokensUsed };
    } catch (err) {
      log.error('Entity extraction failed (timeout or LLM error), returning nulls', {
        error: (err as Error).message,
      });
      return { entities: { ...NULL_ENTITIES }, tokensUsed: { ...ZERO_TOKENS } };
    }
  }

  async generateClarification(
    missingEntities: string[],
    context: ConversationMessage[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const historyText = context.length > 0
      ? `\nConversation so far:\n${formatHistory(context)}\n`
      : '';

    const prompt = `The following information is still needed: ${missingEntities.join(', ')}.${historyText}\nGenerate a brief follow-up question to gather this information.`;

    try {
      return await withRetry(
        () => this.call(CLARIFICATION_SYSTEM_PROMPT, prompt),
        1,
        1000,
      );
    } catch (err) {
      log.error('Clarification generation failed, using fallback', { error: (err as Error).message });
      return {
        text: `Could you tell me more about your ${missingEntities.join(' and ')}?`,
        tokensUsed: { ...ZERO_TOKENS },
      };
    }
  }

  async generateWrapper(
    recommendation: Record<string, unknown>,
    context: ConversationMessage[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const historyText = context.length > 0
      ? `\nConversation so far:\n${formatHistory(context)}\n`
      : '';

    const prompt = `Wrap this recommendation in friendly language:${historyText}\nRecommendation: ${JSON.stringify(recommendation)}`;

    try {
      return await withRetry(
        () => this.call(WRAPPER_SYSTEM_PROMPT, prompt),
        1,
        1000,
      );
    } catch (err) {
      log.error('Wrapper generation failed, using fallback', { error: (err as Error).message });
      const title = (recommendation.title as string) ?? 'this modification';
      return {
        text: `Here's something that might help: ${title}. ${(recommendation.description as string) ?? ''}`,
        tokensUsed: { ...ZERO_TOKENS },
      };
    }
  }

  async suggestAlternatives(
    entities: ExtractedEntities,
    availableActivities: string[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const prompt = `The user described: ${JSON.stringify(entities)}\n\nWe don't have specific corrections for their activity yet. Available activities we DO cover: ${availableActivities.join(', ')}.\n\nGenerate a friendly message suggesting they try one of the available activities.`;

    try {
      return await withRetry(
        () => this.call(ALTERNATIVES_SYSTEM_PROMPT, prompt),
        1,
        1000,
      );
    } catch (err) {
      log.error('Alternatives generation failed, using fallback', { error: (err as Error).message });
      const activity = entities.triggering_activity ?? 'that activity';
      return {
        text: `I don't have specific corrections for ${activity} yet, but I can help with ${availableActivities.join(', ')} — do any of those also cause knee pain for you?`,
        tokensUsed: { ...ZERO_TOKENS },
      };
    }
  }
}

// --- Mock Adapter (for testing) ---

const ACTIVITY_KEYWORDS: Record<string, string> = {
  squat: 'squatting',
  squats: 'squatting',
  squatting: 'squatting',
  run: 'running',
  running: 'running',
  jog: 'running',
  jogging: 'running',
  stairs: 'stairs_down',
  downstairs: 'stairs_down',
  'going downstairs': 'stairs_down',
  'down stairs': 'stairs_down',
  upstairs: 'stairs_up',
  'up stairs': 'stairs_up',
  jump: 'jumping',
  jumping: 'jumping',
  cycle: 'cycling',
  cycling: 'cycling',
  bike: 'cycling',
  biking: 'cycling',
  walk: 'walking',
  walking: 'walking',
  sit: 'sitting',
  sitting: 'sitting',
  kneel: 'kneeling',
  kneeling: 'kneeling',
  lunge: 'lunging',
  lunging: 'lunging',
  pivot: 'pivoting',
  pivoting: 'pivoting',
};

const SIDE_KEYWORDS: Record<string, string> = {
  left: 'left',
  right: 'right',
  both: 'both',
  bilateral: 'both',
};

const LOCATION_KEYWORDS: Record<string, string> = {
  kneecap: 'patella',
  'front of knee': 'patella',
  'front of the knee': 'patella',
  'below kneecap': 'patellar_tendon',
  'below the kneecap': 'patellar_tendon',
  'under kneecap': 'patellar_tendon',
  'above kneecap': 'supra_patellofemoral_joint',
  'above the kneecap': 'supra_patellofemoral_joint',
  'inner knee': 'anteromedial_tibial_plateau',
  'inside of knee': 'anteromedial_tibial_plateau',
  'outer knee': 'anterolateral_tibial_plateau',
  'outside of knee': 'anterolateral_tibial_plateau',
  'back of knee': 'posteromedial_tibial_plateau',
  'behind the knee': 'posteromedial_tibial_plateau',
};

const DESCRIPTION_KEYWORDS: Record<string, string> = {
  sharp: 'sharp',
  dull: 'dull',
  aching: 'aching',
  achy: 'aching',
  sore: 'aching',
  burning: 'burning',
  throbbing: 'throbbing',
  stabbing: 'stabbing',
  tingling: 'tingling',
  stiff: 'stiffness',
  stiffness: 'stiffness',
  tight: 'tightness',
  tightness: 'tightness',
  pressure: 'pressure',
  clicking: 'clicking',
  clicks: 'clicking',
  popping: 'popping',
  pops: 'popping',
  grinding: 'grinding',
  locking: 'locking',
  locks: 'locking',
  'gives way': 'giving_way',
  'giving way': 'giving_way',
  buckles: 'giving_way',
  unstable: 'giving_way',
  swollen: 'swelling',
  swelling: 'swelling',
  puffy: 'swelling',
};

function keywordMatch(text: string, keywords: Record<string, string>): string | null {
  const lower = text.toLowerCase();
  // Check multi-word phrases first (longer keys first)
  const sorted = Object.entries(keywords).sort((a, b) => b[0].length - a[0].length);
  for (const [keyword, value] of sorted) {
    if (lower.includes(keyword)) return value;
  }
  return null;
}

export class MockLLMAdapter implements LLMAdapter {
  async extractEntities(
    userMessage: string,
    _conversationHistory: ConversationMessage[],
  ): Promise<{ entities: ExtractedEntities; tokensUsed: TokenUsage }> {
    const entities: ExtractedEntities = {
      symptom_side: keywordMatch(userMessage, SIDE_KEYWORDS) as ExtractedEntities['symptom_side'],
      triggering_activity: keywordMatch(userMessage, ACTIVITY_KEYWORDS) as ExtractedEntities['triggering_activity'],
      symptom_location: keywordMatch(userMessage, LOCATION_KEYWORDS) as ExtractedEntities['symptom_location'],
      symptom_description: keywordMatch(userMessage, DESCRIPTION_KEYWORDS) as ExtractedEntities['symptom_description'],
    };

    return { entities, tokensUsed: { ...ZERO_TOKENS } };
  }

  async generateClarification(
    missingEntities: string[],
    _context: ConversationMessage[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const text = `Could you tell me more about your ${missingEntities.join(' and ')}?`;
    return { text, tokensUsed: { ...ZERO_TOKENS } };
  }

  async generateWrapper(
    recommendation: Record<string, unknown>,
    _context: ConversationMessage[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const title = (recommendation.title as string) ?? 'this modification';
    const text = `Here's something that might help: ${title}. ${(recommendation.description as string) ?? ''}`;
    return { text, tokensUsed: { ...ZERO_TOKENS } };
  }

  async suggestAlternatives(
    entities: ExtractedEntities,
    availableActivities: string[],
  ): Promise<{ text: string; tokensUsed: TokenUsage }> {
    const activity = entities.triggering_activity ?? 'that activity';
    const text = `I don't have specific corrections for ${activity} yet, but I can help with ${availableActivities.join(', ')} — do any of those also cause knee pain for you?`;
    return { text, tokensUsed: { ...ZERO_TOKENS } };
  }
}

// --- Factory ---

export function createLLMAdapter(
  provider: 'gemini' | 'anthropic' | 'openai',
  apiKey: string,
): LLMAdapter {
  switch (provider) {
    case 'gemini':
      return new GeminiAdapter(apiKey);
    case 'anthropic':
      throw new Error('Anthropic adapter not yet implemented');
    case 'openai':
      throw new Error('OpenAI adapter not yet implemented');
    default:
      throw new Error(`Unknown LLM provider: ${provider}`);
  }
}
