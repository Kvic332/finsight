# FinSight release checklist

Use this for every update and every new build. Each step is here because skipping it has caused a real problem.

## Channels

| Channel | Who gets it | Used for |
|---|---|---|
| `preview` | Test phones only | Trying changes before anyone else sees them |
| `production` | Everyone who installs from the Play Store | Releases |

Never test on `production`. Publish to `production` only after the same change has worked on `preview`.

## Before publishing an update

1. All tests pass:
   ```bash
   cd finsight-mobile && npm test
   ```
   ```bash
   npm test --prefix ../tests
   ```
2. The Android bundle builds:
   ```bash
   npx expo export --platform android
   ```
3. `finsight-mobile/.env` exists. Updates take their server addresses from it, and without it ARIA and Compare & Grow stop working.
4. Changes to permissions, native libraries, the icon or the splash need a new build, not an update.

## Publishing an update

```bash
npx eas-cli update --channel preview --platform android --message "What changed"
```

- **Never publish an update while a build is running.** A build made after an update counts as newer, so phones with that build ignore the update. If it happens, publish the update again once the build has finished.
- Phones apply an update after the app is fully closed and opened twice.

## Checking it on a phone

Open each of these and look for anything wrong:

- [ ] Home: figures load, and scrolling doesn't slide under the clock
- [ ] Activity: transactions, search, and opening one
- [ ] Add transaction: typing, the category, and Say it
- [ ] Plan: Budget, Savings, Debts and Payday
- [ ] Grow: all three tabs load, with "Last checked" dates
- [ ] ARIA: one question gets an answer
- [ ] Settings: Cloud backup shows the last backup and automatic backup status
- [ ] Bank alert capture: a new alert arrives in "New from your bank"

## Before a Play Store release

- [ ] Crash reporting is set up (see below)
- [ ] Production build, made with the `production` profile
- [ ] Privacy policy reviewed by a lawyer and published at a public link
- [ ] Play Console: Data safety form, financial features declaration, and the case for notification access (bank alert capture)
- [ ] Tested on at least one Tecno, Infinix or itel phone, as well as Xiaomi
- [ ] Supabase on a paid plan, so the project never pauses
- [ ] Fund yields refreshed by the `sec-fund-rates` job in the last two weeks

## Crash reporting

Not set up yet. It needs:

1. A Sentry account and a project for React Native. The free plan is enough to start.
2. The project's DSN, added to `finsight-mobile/.env` as `EXPO_PUBLIC_SENTRY_DSN` and to the EAS environment.
3. A new build, because it adds a native library.

Reports must leave out names, amounts, descriptions and anything else from a user's finances. Only the error, the screen and the phone model should be sent. The privacy policy needs a line about it.
