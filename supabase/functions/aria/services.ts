// The real implementations behind handler.ts. Libraries are passed in because
// Deno and the test runner import them differently.

import type { Caller, ChatMessage, ModelReply, QuotaResult } from './handler.ts';

export const FIREBASE_JWKS_URL =
  'https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com';

type JwtVerify = (
  token: string,
  options: { issuer: string; audience: string; algorithms: string[] },
) => Promise<{ payload: Record<string, unknown> }>;

export function createFirebaseVerifier(jwtVerify: JwtVerify, projectId: string) {
  return async (token: string): Promise<Caller> => {
    const { payload } = await jwtVerify(token, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
      algorithms: ['RS256'],
    });
    if (typeof payload.sub !== 'string' || !payload.sub) throw new Error('token has no subject');
    const firebase = payload.firebase as { sign_in_provider?: string } | undefined;
    return { uid: payload.sub, isAnonymous: firebase?.sign_in_provider === 'anonymous' };
  };
}

type Limits = { signedIn: number; anonymous: number; global: number };

export function createQuotaChecker(
  fetchFn: typeof fetch, supabaseUrl: string, serviceKey: string, limits: Limits,
) {
  return async (caller: Caller): Promise<QuotaResult> => {
    const res = await fetchFn(`${supabaseUrl}/rest/v1/rpc/consume_aria_quota`, {
      method: 'POST',
      headers: {
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        p_uid: caller.uid,
        p_user_limit: caller.isAnonymous ? limits.anonymous : limits.signedIn,
        p_global_limit: limits.global,
      }),
    });
    if (!res.ok) throw new Error(`quota check returned ${res.status}`);
    return await res.json() as QuotaResult;
  };
}

type AnthropicClient = {
  beta: { messages: { create: (params: Record<string, unknown>) => Promise<unknown> } };
};
type ApiMessage = { stop_reason?: string; content: { type: string; text?: string }[] };

export function createModelCaller(client: AnthropicClient, model: string) {
  return async (system: string, messages: ChatMessage[]): Promise<ModelReply> => {
    const response = await client.beta.messages.create({
      model,
      // A ceiling, not a target. Thinking counts towards it, so it sits well
      // above the few sentences ARIA is asked to write.
      max_tokens: 4000,
      output_config: { effort: 'low' },
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages,
    }) as ApiMessage;

    if (response.stop_reason === 'refusal') return { text: '', refused: true };
    const text = response.content
      .filter(block => block.type === 'text')
      .map(block => block.text || '')
      .join('')
      .trim();
    return { text, refused: false };
  };
}
