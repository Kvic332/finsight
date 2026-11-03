import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.15';
import { createHandler } from './handler.ts';
import {
  createFirebaseVerifier, createModelCaller, createQuotaChecker, FIREBASE_JWKS_URL,
} from './services.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const number = (name: string, fallback: number) => Number(Deno.env.get(name)) || fallback;

const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

// Created on first use, so a missing key fails that request instead of the
// whole function, which keeps rejecting bad callers either way.
let callModel: ReturnType<typeof createModelCaller> | undefined;

const handler = createHandler({
  verifyToken: createFirebaseVerifier(
    (token, options) => jwtVerify(token, jwks, options),
    Deno.env.get('FIREBASE_PROJECT_ID') || 'finsight-2f945',
  ),
  consumeQuota: createQuotaChecker(
    fetch,
    required('SUPABASE_URL'),
    required('SUPABASE_SERVICE_ROLE_KEY'),
    {
      signedIn: number('ARIA_DAILY_LIMIT_SIGNED_IN', 40),
      anonymous: number('ARIA_DAILY_LIMIT_ANONYMOUS', 15),
      global: number('ARIA_DAILY_LIMIT_GLOBAL', 2000),
    },
  ),
  callModel: async (system, messages) => {
    callModel ??= createModelCaller(
      new Anthropic({ apiKey: required('ANTHROPIC_API_KEY') }),
      Deno.env.get('ARIA_MODEL') || 'claude-opus-5-5',
    );
    return callModel(system, messages);
  },
  logError: (event, status) => console.error(JSON.stringify({ event, status })),
});

Deno.serve(handler);
