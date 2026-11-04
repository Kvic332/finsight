import { createRemoteJWKSet, jwtVerify } from 'npm:jose@6.2.15';
import { createFirebaseVerifier, FIREBASE_JWKS_URL } from '../aria/services.ts';
import { createHandler } from './handler.ts';
import { createAdminChecker, createStore } from './services.ts';

function required(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not set`);
  return value;
}

const projectId = Deno.env.get('FIREBASE_PROJECT_ID') || 'finsight-2f945';
const jwks = createRemoteJWKSet(new URL(FIREBASE_JWKS_URL));

const handler = createHandler({
  verifyToken: createFirebaseVerifier((token, options) => jwtVerify(token, jwks, options), projectId),
  isAdmin: createAdminChecker(fetch, projectId),
  store: createStore(fetch, required('SUPABASE_URL'), required('SUPABASE_SERVICE_ROLE_KEY')),
  now: () => new Date(),
  logError: (event, code) => console.error(JSON.stringify({ event, code })),
});

Deno.serve(handler);
