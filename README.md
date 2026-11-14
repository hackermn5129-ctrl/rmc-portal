# RMC Portal

Portal for Rashid Minhas Higher Secondary School Chichawatni: admin, teacher, student and parent.

## What works now

- Sign in with phone number and password (`/login`).
- One-time setup of the principal's account (`/setup`). Needs the one-time setup code.
- Each role lands on its own home (`/admin`, `/teacher`, `/student`, `/parent`).
- Admin home shows live totals and lets the admin add classes.

## Run it

```bash
cp .env.example .env.local
npm install
npm run dev
```

## How sign-in works

People type a phone number. Behind the scenes each account has a private login ID made from that number
(`03001234567@users.rmc-portal.app`), so no SMS service is needed and nothing is ever emailed.
Only the admin creates accounts, through the `manage-users` function in `supabase/functions`.

## Where things are

- `app/` pages. `components/` shared parts. `lib/` database connection and helpers.
- `supabase/functions/manage-users/` the account-creation function (already deployed).
- Database tables and privacy rules live in the Supabase project `rmc-portal`.
