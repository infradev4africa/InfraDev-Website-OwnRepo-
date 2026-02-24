# InfraDev Contact Form Audit Context

## Goal
Stabilize the landing-page contact form verification flow and email initiation flow on Cloudflare Workers.

## Current User-Visible Issue
- Form shows verification-related errors.
- Most common message observed: verification widget not visible/loaded.
- We are treating this as a high-priority production path issue.

## Runtime Architecture
- Frontend page: `index.html`
- Backend worker: `worker.js`
- Worker config: `wrangler.jsonc`
- Deploy remote (Cloudflare source): `cloudflare` -> `https://github.com/tise05/InfraDev-Website.git`

## Contact Flow
1. Frontend renders Turnstile explicitly.
2. Frontend submits `/api/contact/initiate`.
3. Worker verifies Turnstile token via Cloudflare siteverify API.
4. Worker sends verification email using Resend API.
5. User clicks verification link (`/api/contact/verify`).
6. Worker routes verified lead and stores replay key in KV.

## Required Worker Variables (names only)
- `TURNSTILE_SITE_KEY` (plaintext)
- `TURNSTILE_SECRET` (secret)
- `VERIFICATION_SIGNING_SECRET` (secret)
- `RESEND_API_KEY` (secret)
- `EMAIL_FROM` (secret/plaintext depending setup)
- `LEAD_DESTINATION_EMAIL` (plaintext)
- `LEADS_KV` (KV binding)

## Recent Hardening Commits
- `6a251f8` Harden Turnstile script loading with explicit diagnostics and retry path
- `8ce573c` Support execute-based Turnstile flow when widget is not visibly rendered
- `55f3291` Improve Turnstile submit flow for late-loading widget
- `b62a6fd` Improve contact submit diagnostics for email delivery failures
- `d9fa39d` Load Turnstile site key from runtime config endpoint
- `71e432b` Add robust Turnstile load diagnostics and fallback messaging
- `387c6e2` Render Turnstile explicitly and surface verification load errors
- `f2883fe` Improve contact form error visibility near submit action
- `0244eec` Implement Turnstile and email-verified contact flow on Cloudflare

## What Changed in the Latest Escalation
- Added a defensive Turnstile script loader.
- Added script load timeout and explicit error codes shown in status messaging.
- Added fallback script injection if script tag is missing.
- Added richer comments around verification initialization logic.

## Known Investigation Focus
- Is `window.turnstile` available on production page load?
- Does script fail to load due to browser/privacy tooling or CSP/network conditions?
- Is Turnstile widget mode/appearance aligned with current UI assumptions?
- Is hostname/domain alignment correct for the configured Turnstile site key?

## Repro Checklist
1. Open landing page.
2. Hard refresh (`Ctrl+F5`).
3. Fill required fields.
4. Submit once.
5. Capture exact error message shown in form status.

## Security Note for External Review
- Do not share secret values.
- Share variable names and architecture only.
- If sharing logs, redact tokens, API keys, and signed verification URLs.
