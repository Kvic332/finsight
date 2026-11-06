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

## PDF statements

The `statement-reader` function reads PDF statements with Claude, after the app asks for consent. It keeps nothing, and logs only an event name and a status code. Excel and CSV files never reach it.

```bash
supabase functions deploy statement-reader --no-verify-jwt
```

Password-protected PDFs aren't supported, because Claude can't open them. Requests stop after about 8 MB of PDF.

| Secret | Default | Meaning |
|---|---|---|
| `STATEMENT_MODEL` | `claude-opus-5-5` | Claude model |
| `STATEMENT_DAILY_LIMIT_SIGNED_IN` | `5` | Statements per day, per account |
| `STATEMENT_DAILY_LIMIT_ANONYMOUS` | `2` | Statements per day, without an account |
| `STATEMENT_DAILY_LIMIT_GLOBAL` | `100` | Statements per day across everyone. This is the spending cap |

## App updates without a new APK

Builds listen on the channel named in `eas.json`, such as `preview`. JavaScript fixes can be sent to phones with:

```bash
cd finsight-mobile
eas update --channel preview --message "What changed"
```

Updates take their `EXPO_PUBLIC_` values from `finsight-mobile/.env` on the computer that publishes them, not from `eas.json`. If that file is missing, ARIA and Compare & Grow stop working in the update. Changes to the icon, splash, permissions or native libraries still need a new build.

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

### Catalogue admin

Admins manage the catalogue in the app, under **Settings → Admin → Compare catalogue**. The screen calls the `catalog-admin` function, which holds the only write access.

```bash
supabase functions deploy catalog-admin --no-verify-jwt
```

The function checks each request in this order:

1. The Firebase token is valid and isn't anonymous.
2. Firestore confirms `admins/<uid>` exists, using the caller's own token. This needs the rules in `firestore.rules` to be deployed. If Firestore can't be reached, the request stops.
3. The request passes validation, and only known fields reach the database. Who made the change comes from the token.

Providers and products can be archived but not deleted, so their history stays intact.

### Weekly fund yields

`sec-fund-rates` keeps money market fund yields current from the SEC's weekly valuation report. A database job (`sec-fund-rates` in `cron.job`) calls it daily at 08:15 Lagos time, and it does nothing until a newer report is published.

```bash
supabase functions deploy sec-fund-rates --no-verify-jwt
```

- It only accepts calls carrying the secret named `sec_import_secret` in the database vault. The function checks it through `check_sec_import_secret`, which only the service role can call.
- Funds are matched to the report by exact name. A new yield is applied only if it's between 5% and 40% and moved less than 3 points since the last figure. Anything else is held.
- Every decision is logged in `fund_rate_imports` with status `applied`, `held` or `unmatched`. Held and unmatched funds keep their old rate until someone updates them in the catalogue admin.
- Applied rates keep their history through the `rates_record_history` trigger, as manual changes do.

To see recent decisions:

```sql
select p.name, i.report_date, i.status, i.proposed_pct, i.reason
from fund_rate_imports i join products p on p.id = i.product_id
order by i.created_at desc limit 20;
```
