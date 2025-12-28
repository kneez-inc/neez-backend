import { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';

type AllowedIntent = 'red_flag' | 'acute_relief' | 'rehab_request' | 'general_education' | 'out_of_scope';

type IntentResult = {
  intent: AllowedIntent;
  raw: string;
};

type IntentRouterResponse = {
  output_text?: string;
};

const INTENT_SCHEMA = {
  type: 'object',
  properties: {
    intent: {
      type: 'string',
      enum: ['red_flag', 'acute_relief', 'rehab_request', 'general_education', 'out_of_scope']
    }
  },
  required: ['intent'],
  additionalProperties: false
} as const;

const intentRouterPrompt = `System prompt (for the router LLM)
You are a routing classifier for the Kneez app. Your ONLY job is to decide the user’s intent from their first message and output a single JSON object. Do not answer the question or give advice. Return only valid JSON with a single property, intent, whose value is one of the allowed strings below. No extra text.

Decision rules (apply in this order; the first match wins):

red_flag – Any red-flag symptoms (e.g., recent major trauma, audible pop with immediate swelling and inability to bear weight, severe deformity, fever with hot/red joint, suspected infection, foot/calf swelling with shortness of breath, numbness with loss of bladder/bowel control).

acute_relief – The user reports knee symptoms during a specific activity and seems to want immediate relief (e.g., “my left knee hurts when I squat/go upstairs/run”).

rehab_request – The user asks for stretching, mobility, or strengthening plans, long-term fixes, rehab programs, or prevention (not immediate symptom relief).

general_education – Curiosity/learning questions about knee anatomy, knee symptom causes, diagnoses, imaging, timelines, what a knee structure is/does, anything knee-related, without asking for a symptom fix.

out_of_scope – Not about knees, or unrelated.

Allowed intent string values:

"red_flag"

"acute_relief"

"rehab_request"

"general_education"

"out_of_scope"

Output format: {"intent":"<one of the above>"}
No other keys. No explanations. Always valid JSON.

User prompt template (what you send with the user’s message)
Classify the user’s intent for routing. Remember: return only the JSON object with intent.

User message:
{USER_MESSAGE_GOES_HERE}
Quick examples (for your tests)
“the back of my right knee hurts when I go downstairs” → {"intent":"acute_relief"}

“what is the muscle above the knee called?” → {"intent":"general_education"}

“what stretches can I do to fix runner’s knee long term?” → {"intent":"long_term_solution"}

“I heard a pop, can’t put weight on it, knee looks crooked” → {"intent":"emergency_red_flag"}

“my shoulder hurts when benching” → {"intent":"out_of_scope"}

Tips to make this work reliably
Precedence matters: run the red-flag check first so emergencies never get misrouted.

Keep it JSON-only: in your calling code, reject and re-ask if the response isn’t valid JSON with only intent.

Guardrails: temperature ≤ 0.2; top_p ≤ 0.2 to keep outputs deterministic.

Telemetry: log the raw user message + classified intent to spot drift and refine prompts later.`;

const sendJson = (res: ServerResponse, status: number, payload: unknown) => {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(payload, null, 2));
};

const parseBody = async (req: IncomingMessage): Promise<any> => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString('utf8');
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error('Invalid JSON body');
  }
};

const buildUserPrompt = (message: string) =>
  `Classify the user’s intent for routing. Remember: return only the JSON object with intent.\n\nUser message:\n${message}`;

const getApiKey = () => {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY is required for LLM intent routing');
  return apiKey;
};

const classifyIntent = async (text: string, fetchImpl: typeof fetch = fetch): Promise<IntentResult> => {
  const apiKey = getApiKey();
  const model = process.env.INTENT_ROUTER_MODEL ?? 'gpt-4o-mini';
  const userPrompt = buildUserPrompt(text);

  const response = await fetchImpl('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      top_p: 0.2,
      input: [
        { role: 'system', content: intentRouterPrompt },
        { role: 'user', content: userPrompt }
      ],
      text: {
        format: {
          type: 'json_schema',
          name: 'intent_router',
          strict: true,
          schema: INTENT_SCHEMA
        }
      }
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LLM intent router failed: ${response.status} ${errorText}`);
  }

  const data = (await response.json()) as IntentRouterResponse;
  const raw = data.output_text;

  if (!raw) {
    throw new Error('LLM intent router returned an empty response');
  }

  let parsed: IntentResult['intent'];
  try {
    const json = JSON.parse(raw) as { intent?: AllowedIntent };
    if (!json.intent) throw new Error('missing intent');
    parsed = json.intent;
  } catch (error: any) {
    throw new Error(`Failed to parse intent JSON: ${error?.message ?? 'unknown error'}`);
  }

  return { intent: parsed, raw };
};

const extractText = async (req: IncomingMessage, url: URL) => {
  if (req.method === 'GET') {
    return url.searchParams.get('text') ?? url.searchParams.get('q') ?? '';
  }

  const body = await parseBody(req);
  const text = body?.text ?? body?.message ?? body?.query ?? '';
  return typeof text === 'string' ? text : '';
};

export const handleNluRequest = async (req: IncomingMessage, res: ServerResponse) => {
  const url = new URL(req.url ?? '', 'http://localhost');

  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (url.pathname !== '/nlu/intent') {
    sendJson(res, 404, { error: 'Not Found' });
    return;
  }

  if (req.method !== 'GET' && req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method Not Allowed' });
    return;
  }

  try {
    const text = (await extractText(req, url)).trim();
    if (!text) {
      sendJson(res, 400, { error: 'text is required' });
      return;
    }

    const intent = await classifyIntent(text);
    sendJson(res, 200, { text, intent: intent.intent });
  } catch (error: any) {
    const message = error?.message ?? 'Unable to process request';
    const status = message === 'Invalid JSON body' ? 400 : 500;
    sendJson(res, status, { error: message });
  }
};

export const __testing = {
  classifyIntent
};
