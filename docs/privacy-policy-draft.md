# FinSight privacy policy (draft)

**This is a draft for a lawyer to review, not legal advice.** It describes how the app works today. Before publishing, have it checked against the Nigeria Data Protection Act 2023, and fill in the items in [brackets].

Last updated: [date]

## Who we are

FinSight is run by [legal name and registered address]. To contact us about your data, email [privacy contact].

## What we collect

**Stored on your phone**
- Your name and any profile details you add, such as your email, phone number, date of birth, sex, nationality, job and photo
- Your income, payday, banks, budgets and savings goals
- Debts you add, such as who you owe, how much, the cost and due dates
- Transactions you enter, paste from bank SMS, import from a statement, or capture from bank notifications if you turn that on

Your transactions, budgets, goals, debts and profile are encrypted on your phone.

If you turn on bank alert capture, Android gives FinSight access to your notifications. FinSight keeps only those from a list of bank apps and from bank SMS senders, and ignores the rest. The text of new alerts stays on your phone, unencrypted in storage only FinSight can use, until you next open the app. It isn't sent to us. [Lawyer to confirm this wording. Google Play also reviews apps that use notification access.]

**Sent to us and our providers only when you use these features**

| Feature | What's sent | Who receives it |
|---|---|---|
| Asking ARIA a question | Your question, and a summary of your finances: name, income, recent transactions, budgets, goals, debts and banks | Our server (Supabase) and our AI provider (Anthropic) |
| Using ARIA | An anonymous ID or your account ID, and a daily message count, to apply usage limits | Google Firebase and Supabase |
| Creating a cloud account | Your name, email and password | Google Firebase |
| Backing up, when you tap Back up now, and automatically about once a day while you're signed in, if something changed. You can turn automatic backup off in Cloud backup | Your transactions, budgets, goals, debts, profile and progress | Google Firebase |
| Being signed in | Basic usage counts, FinScore and level | Google Firebase |
| Reading a PDF statement, after you agree | The whole PDF, including your name, account number and transactions | Our server (Supabase) and our AI provider (Anthropic) |
| Reading a PDF statement | An anonymous ID or your account ID, and a daily count, to apply usage limits | Google Firebase and Supabase |
| Opening Compare & Grow | A request for the provider list, which includes your internet address. None of your finances are sent | Supabase |
| Choosing "Go to provider" | You leave FinSight for that provider's website, where its own privacy policy applies. Some links are referral links, so the provider may know you came from FinSight | The provider |

FinSight may earn from referral links. The app labels those links, and they never change the order of a list.

Backups are protected by Google Firebase's security, not by FinSight's own encryption. [Lawyer to confirm this wording, including who at FinSight can access Firebase.]

## Why we use it

To show your figures, answer your questions, keep backups you ask for, limit misuse of ARIA and understand which features are used. [Lawyer to confirm the lawful basis for each.]

## What we don't do

- We don't sell your data.
- We don't use your data for advertising.
- FinSight can't move your money and never asks for your bank login.

## How long we keep it

- Data on your phone stays until you delete it in Settings or uninstall the app.
- Cloud backups, your profile and your login stay until you delete your account in the app, under Cloud backup. You can also email us to ask. [Confirm how long Google keeps deleted data in its own systems.]
- ARIA message counts contain your account ID and a number, with no message content. They're deleted automatically after 30 days.
- ARIA conversations and PDF statements aren't stored by FinSight. [Confirm the provider's retention terms for both, as statements hold account numbers and full transaction history.]
- PDF statement counts contain your account ID and a number, with no statement content. They're deleted after 30 days.
- Excel and CSV statements stay on your phone and aren't sent anywhere.

## Where it's processed

Our providers may process data outside Nigeria, including in Ireland and the United States. [Lawyer to confirm the transfer basis and each provider's locations.]

## Your rights

You can ask to access, correct or delete your data, object to some uses, or withdraw consent. You can also complain to the Nigeria Data Protection Commission. To make a request, email [privacy contact].

## Children

FinSight isn't intended for anyone under [age].

## Changes

We'll tell you in the app about important changes to this policy.
