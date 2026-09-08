-- Admin "To-Do" — manually tracked action items to sit alongside the
-- automatically-detected ones (failing cron jobs, open PRs) on /admin/todo.
--
-- Auto-detected items need no table — they're computed live from cron_runs
-- and the GitHub API on every page load, and disappear on their own once
-- resolved (a job starts succeeding again, a PR gets merged/closed). This
-- table is only for the items nothing in the codebase can detect: external
-- console/billing changes that require a human to go do something outside
-- of Flowen's own systems.

create type admin_action_item_status as enum ('open', 'done');

create table admin_action_items (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  description  text,
  category     text not null default 'general', -- 'integration' | 'security' | 'billing' | 'general'
  status       admin_action_item_status not null default 'open',
  created_at   timestamptz not null default now(),
  resolved_at  timestamptz,
  resolved_by  text -- admin email, for a lightweight audit trail
);

create index admin_action_items_status_idx on admin_action_items (status, created_at desc);

alter table admin_action_items enable row level security;

-- Admin-only — this table is never read or written from anon/authenticated
-- client contexts, only from the admin-guarded server actions and page,
-- both of which use the service-role client. No policy grants access to
-- anon/authenticated, matching the pattern used for other admin-only tables.

-- Seed with the outstanding items already identified but not yet auto-detectable
-- (each needs a human to change something in an external console/dashboard —
-- Google Ads OAuth is deliberately NOT seeded here, since the "failing cron
-- jobs" auto-detection already surfaces it live with the real error).
insert into admin_action_items (title, description, category) values
  (
    'Enable the ConvoAI add-on in Agora Console',
    'The practice page''s AI avatar session fails to start with "AI conversation not available" — the Agora ConvoAI add-on isn''t enabled for this App ID. Console → the project matching AGORA_APP_ID → enable Conversational AI Engine. If already enabled, check AGORA_CONVOAI_BASE_URL matches the project''s actual region (US/EU/AP).',
    'integration'
  ),
  (
    'Enable Supabase leaked-password protection',
    'Auth → Policies (or Auth settings) in the Supabase dashboard — a security toggle that checks new passwords against known-breach lists. Dashboard-only; no migration or API call can set it.',
    'security'
  ),
  (
    'Upgrade ElevenLabs billing plan',
    'Current plan''s usage ceiling has been hit — needs a plan upgrade on ElevenLabs'' own billing page to lift the limit.',
    'billing'
  );
