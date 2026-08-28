# Supabase Auth Email Templates

Branded HTML templates for Supabase authentication emails. Paste each file's content into the corresponding template in the Supabase dashboard.

**Path:** Authentication → Email Templates

| File | Template type | Subject |
|---|---|---|
| `confirm-signup.html` | Confirm signup | `Confirm your Flowen account` |
| `reset-password.html` | Reset password | `Reset your Flowen password` |
| `magic-link.html` | Magic link | `Your Flowen sign-in link` |
| `change-email.html` | Change email address | `Confirm your new Flowen email address` |
| `invite.html` | Invite user | `Your Flowen access is ready` |

## Variables

These templates use standard Supabase Go template variables:

- `{{ .ConfirmationURL }}` — the action URL (confirm / reset / magic-link / invite)
- `{{ .SiteURL }}` — the site URL (set in Supabase Auth settings)
- `{{ .Email }}` — the user's email address (used in change-email template)

## Post-confirmation redirect

After email confirmation, Supabase redirects to `/auth/callback` (set via `emailRedirectTo` in `src/app/auth/actions.ts`). The callback route (`src/app/auth/callback/route.ts`) then:

- New users (`onboarding_complete = false`) → `/onboarding`
- Admins → `/admin`
- Returning users → `/dashboard`
