# ARIA server function

The app calls this function instead of Anthropic, so the Anthropic key never ships in the app. It checks the caller's Firebase token, applies daily limits, then calls Claude.

## Deploy

Requires the [Supabase CLI](https://supabase.com/docs/guides/cli) and a linked project.

```bash
supabase db push
supabase functions deploy aria --no-verify-jwt
supabase secrets set ANTHROPIC_API_KEY=<new key>
```

Then point the app at it, in `finsight-mobile/.env` for local runs and as an EAS environment variable for builds:

```bash
EXPO_PUBLIC_ARIA_URL=https://<project-ref>.supabase.co/functions/v1/aria
```

In the Firebase console, turn on **Authentication → Sign-in method → Anonymous**. ARIA uses it for people without a FinSight account.

## Optional settings

Set these as Supabase secrets to change the defaults.

| Secret | Default | Meaning |
|---|---|---|
| `ARIA_MODEL` | `claude-opus-5-5` | Claude model |
| `ARIA_DAILY_LIMIT_SIGNED_IN` | `40` | Messages per day, per account |
| `ARIA_DAILY_LIMIT_ANONYMOUS` | `15` | Messages per day, without an account |
| `ARIA_DAILY_LIMIT_GLOBAL` | `2000` | Messages per day across everyone. This is the spending cap |

Days reset at midnight Lagos time.

## Firestore rules

`firestore.rules` is the source of truth. Before deploying them:

1. Create `admins/<your uid>` in the Firestore console, with no fields. Admin access no longer comes from `isAdmin` on the profile.
2. Release the app update first. Older versions write backups to the profile, which these rules block.

```bash
firebase deploy --only firestore:rules --project finsight-2f945
```

## Tests

```bash
cd tests
npm install
npm test
npm run test:rules
```

`test:rules` needs Java and uses the Firestore emulator. App calculations are tested separately with `npm test` in `finsight-mobile`.
