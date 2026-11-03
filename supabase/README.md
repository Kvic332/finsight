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

## Compare and Grow catalogue

The app reads the `compare_listings` view with the publishable key. Only the service role can write. A product is listed only when all of these are true:

- The product and its provider are both `published`.
- The product has a rate, and every rate names a source and the date it was checked.
- The provider's latest check with the right regulator is `verified` and hasn't expired.

| Category | Regulators that count |
|---|---|
| `loan` | FCCPC or CBN |
| `savings` | CBN |
| `fund` | SEC |
| `fx` | CBN |

Licence checks and rate history can only be added to. To correct a check, add a new one. If two checks share a timestamp, the one that isn't `verified` wins.

To test the access rules, run `tests/compare_grow.sql` against a database with the migrations applied. It stops with an error if a check fails, and rolls everything back when it finishes.
