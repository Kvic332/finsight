import Anthropic from 'npm:@anthropic-ai/sdk@1.4.0';
import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.15';
import { createFirebaseVerifier, FIREBASE_JWKS_URL } from '../aria/services.ts';
import { createHandler } from './handler.ts';
import { createPdfReader, createQuotaChecker } from './services.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const number = (name: string, fallback: number) => Number(Deno.env.get(name)) || fallback;

const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

// Created on first use, so a missing key fails that request instead of the
// whole function, which keeps rejecting bad callers either way.
let readPdf: ReturnType<typeof createPdfReader> | undefined;

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
      signedIn: number('STATEMENT_DAILY_LIMIT_SIGNED_IN', 5),
      anonymous: number('STATEMENT_DAILY_LIMIT_ANONYMOUS', 2),
      global: number('STATEMENT_DAILY_LIMIT_GLOBAL', 100),
    },
  ),
  readPdf: async (base64) => {
    readPdf ??= createPdfReader(
      new Anthropic({ apiKey: required('ANTHROPIC_API_KEY') }),
      Deno.env.get('STATEMENT_MODEL') || 'claude-opus-5-5',
    );
    return readPdf(base64);
  },
  logError: (event, status) => console.error(JSON.stringify({ event, status })),
});

Deno.serve(handler);
