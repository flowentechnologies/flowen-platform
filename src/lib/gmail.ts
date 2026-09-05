// ── Gmail API helper ──────────────────────────────────────────────────────────
// Single-mailbox integration (admin@flowen.digital), not domain-wide
// delegation — all the @flowen.digital aliases already route into this one
// Workspace inbox (see src/lib/email.ts). A single OAuth grant from the
// admin@ user, refreshed by a daily cron, is all that's needed.
//
// Required OAuth scopes (configured on the Google Cloud OAuth client):
//   - https://www.googleapis.com/auth/gmail.modify
//   - https://www.googleapis.com/auth/gmail.settings.basic
//   - https://www.googleapis.com/auth/gmail.settings.sharing  (required by
//     Gmail's API specifically to create "send as" aliases — the basic
//     scope alone isn't sufficient for that one operation)
//
// SECURITY: every function here is server-only. Never import this from a
// client component — it reads/writes the raw OAuth tokens via adminDb().

import { adminDb as db } from '@/lib/supabase/admin';
import { FROM } from '@/lib/email';

const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me';

export interface GmailTokenRow {
  id: string;
  mailbox: string;
  access_token: string;
  refresh_token: string | null;
  expires_at: string | null;
  scope: string | null;
}

/** Every alias this mailbox is configured to send/receive as. Derived from
 *  the same FROM map used for transactional email, so the two never drift
 *  apart — one source of truth for "what aliases does Flowen have". */
export const ALIASES = Object.keys(FROM) as (keyof typeof FROM)[];

export function aliasEmail(alias: string): string {
  return `${alias}@flowen.digital`;
}

// ── Token management ───────────────────────────────────────────────────────────

export async function getStoredTokens(): Promise<GmailTokenRow | null> {
  const { data, error } = await db()
    .from('gmail_oauth_tokens')
    .select('*')
    .eq('id', 'admin')
    .maybeSingle();
  if (error || !data) return null;
  return data as GmailTokenRow;
}

/** Returns a valid (non-expired) access token, refreshing first if needed.
 *  Called by every Gmail API request below — callers never touch tokens
 *  directly. Returns null if Gmail has never been connected. */
export async function getValidAccessToken(): Promise<string | null> {
  const row = await getStoredTokens();
  if (!row) return null;

  const expiresAt = row.expires_at ? new Date(row.expires_at).getTime() : 0;
  const stillValid = expiresAt > Date.now() + 60_000; // 60s safety margin
  if (stillValid) return row.access_token;

  if (!row.refresh_token) return null; // can't refresh — needs reconnect

  const clientId = process.env.GMAIL_CLIENT_ID;
  const clientSecret = process.env.GMAIL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  const body = await res.json() as { access_token?: string; expires_in?: number; error?: string };
  if (!res.ok || !body.access_token) {
    console.error('[gmail] token refresh failed:', body.error);
    return null;
  }

  const expires_at = new Date(Date.now() + (body.expires_in ?? 3600) * 1000).toISOString();
  await db().from('gmail_oauth_tokens').update({
    access_token: body.access_token,
    expires_at,
    updated_at: new Date().toISOString(),
  }).eq('id', 'admin');

  return body.access_token;
}

async function gmailFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Gmail not connected — visit /admin/inbox to connect.');
  return fetch(`${GMAIL_API}${path}`, {
    ...init,
    headers: {
      ...init.headers,
      Authorization: `Bearer ${token}`,
    },
  });
}

// ── Reading mail ───────────────────────────────────────────────────────────────

export interface MimePart {
  mimeType?: string;
  body?: { data?: string };
  parts?: MimePart[];
}

export interface GmailMessageMeta {
  id: string;
  threadId: string;
  labelIds?: string[];
  snippet?: string;
  payload?: {
    headers?: { name: string; value: string }[];
    body?: { data?: string };
    parts?: MimePart[];
  };
  internalDate?: string;
}

/** Lists message IDs newer than the given Gmail history/query cursor.
 *  Uses a simple `after:` search rather than the history API for
 *  simplicity — fine at this mailbox's volume; revisit with history.list
 *  if sync volume ever grows large enough for search to lag.
 *
 *  Gmail search excludes Spam and Trash by default — `{in:inbox in:spam}`
 *  (curly braces = OR) explicitly includes Spam too, since the admin wants
 *  spam visible/categorised in /admin/inbox, not silently dropped. Trash
 *  stays excluded — those were deliberately deleted, not worth surfacing. */
export async function listRecentMessageIds(maxResults = 50): Promise<string[]> {
  const q = encodeURIComponent('newer_than:2d {in:inbox in:spam}');
  const res = await gmailFetch(`/messages?maxResults=${maxResults}&q=${q}`);
  if (!res.ok) throw new Error(`Gmail list failed: ${res.status}`);
  const body = await res.json() as { messages?: { id: string }[] };
  return (body.messages ?? []).map(m => m.id);
}

/** Maps Gmail's own system labels (the Primary/Social/Promotions/Updates/
 *  Forums inbox tabs, plus Spam) to a simple category string. Deliberately
 *  distinct from this app's own `category` column (billing/press/security/
 *  etc., derived from alias + vendor domain) — this answers "what kind of
 *  mail is this, per Gmail's own classifier", not "which business function". */
export function resolveGmailCategory(labelIds: string[] | undefined): string | null {
  if (!labelIds) return null;
  if (labelIds.includes('SPAM')) return 'spam';
  if (labelIds.includes('CATEGORY_SOCIAL')) return 'social';
  if (labelIds.includes('CATEGORY_PROMOTIONS')) return 'promotions';
  if (labelIds.includes('CATEGORY_UPDATES')) return 'updates';
  if (labelIds.includes('CATEGORY_FORUMS')) return 'forums';
  if (labelIds.includes('CATEGORY_PERSONAL')) return 'primary';
  return null;
}

export async function getMessage(id: string): Promise<GmailMessageMeta> {
  const res = await gmailFetch(`/messages/${id}?format=full`);
  if (!res.ok) throw new Error(`Gmail get message failed: ${res.status}`);
  return res.json() as Promise<GmailMessageMeta>;
}

function decodeBase64Url(data: string): string {
  return Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf-8');
}

/** Walks the MIME tree (recursively — multipart/alternative can itself be
 *  nested inside multipart/mixed) for the first text/plain part, falling
 *  back to text/html stripped of tags if no plain part exists anywhere. */
export function extractBodyText(payload: GmailMessageMeta['payload']): string {
  if (!payload) return '';
  if (payload.body?.data) return decodeBase64Url(payload.body.data);
  return extractFromParts(payload.parts ?? []);
}

function extractFromParts(parts: MimePart[]): string {
  const plain = parts.find(p => p.mimeType === 'text/plain');
  if (plain?.body?.data) return decodeBase64Url(plain.body.data);

  const html = parts.find(p => p.mimeType === 'text/html');
  if (html?.body?.data) {
    return decodeBase64Url(html.body.data).replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  }

  for (const part of parts) {
    if (part.parts?.length) {
      const text = extractFromParts(part.parts);
      if (text) return text;
    }
  }
  return '';
}

export function getHeader(payload: GmailMessageMeta['payload'], name: string): string | undefined {
  return payload?.headers?.find(h => h.name.toLowerCase() === name.toLowerCase())?.value;
}

/** Determines which @flowen.digital alias actually received this message,
 *  by checking Delivered-To first (most reliable — set by Gmail's own
 *  routing) and falling back to the To/Cc headers. */
export function resolveAlias(payload: GmailMessageMeta['payload']): string {
  const deliveredTo = getHeader(payload, 'Delivered-To');
  const candidates = [deliveredTo, getHeader(payload, 'To'), getHeader(payload, 'Cc')]
    .filter((v): v is string => !!v)
    .join(', ');

  for (const alias of ALIASES) {
    if (candidates.toLowerCase().includes(`${alias}@flowen.digital`)) return alias;
  }
  return 'admin';
}

// ── Labels ─────────────────────────────────────────────────────────────────────

let _labelCache: Map<string, string> | null = null;

async function getOrCreateLabel(name: string): Promise<string> {
  if (!_labelCache) {
    const res = await gmailFetch('/labels');
    const body = await res.json() as { labels?: { id: string; name: string }[] };
    _labelCache = new Map((body.labels ?? []).map(l => [l.name, l.id]));
  }
  const existing = _labelCache.get(name);
  if (existing) return existing;

  const res = await gmailFetch('/labels', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, labelListVisibility: 'labelShow', messageListVisibility: 'show' }),
  });
  const body = await res.json() as { id: string };
  _labelCache.set(name, body.id);
  return body.id;
}

/** Applies a "Flowen/<category>" label to a message so the categorisation
 *  is visible in Gmail itself, not just in /admin/inbox. */
export async function applyLabel(messageId: string, labelName: string): Promise<void> {
  const labelId = await getOrCreateLabel(labelName);
  await gmailFetch(`/messages/${messageId}/modify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ addLabelIds: [labelId] }),
  });
}

// ── Send-as aliases (one-time setup, idempotent) ────────────────────────────────

/** Ensures every alias in FROM exists as a Gmail "send as" identity, so
 *  replies can go out looking like they came from security@, press@, etc.
 *  instead of admin@. Safe to call repeatedly — Gmail 409s on a duplicate,
 *  which is swallowed here. Call once after connecting (see callback route). */
export async function ensureSendAsAliases(): Promise<{ created: string[]; skipped: string[] }> {
  const created: string[] = [];
  const skipped: string[] = [];

  const existingRes = await gmailFetch('/settings/sendAs');
  const existingBody = await existingRes.json() as { sendAs?: { sendAsEmail: string }[] };
  const existing = new Set((existingBody.sendAs ?? []).map(s => s.sendAsEmail));

  for (const alias of ALIASES) {
    const email = aliasEmail(alias);
    if (existing.has(email)) { skipped.push(alias); continue; }

    const displayName = FROM[alias].split(' <')[0];
    const res = await gmailFetch('/settings/sendAs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sendAsEmail: email,
        displayName,
        treatAsAlias: true,
      }),
    });
    if (res.ok) created.push(alias);
    else skipped.push(alias); // e.g. already pending verification from a prior attempt
  }

  return { created, skipped };
}

// ── Sending (reply or fresh outreach) — only ever called after admin approval ──

function buildRawMessage(opts: {
  from: string;
  to: string;
  subject: string;
  body: string;
  inReplyTo?: string;
  references?: string;
  threadId?: string;
}): string {
  const lines = [
    `From: ${opts.from}`,
    `To: ${opts.to}`,
    `Subject: ${opts.subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    'MIME-Version: 1.0',
  ];
  if (opts.inReplyTo) lines.push(`In-Reply-To: ${opts.inReplyTo}`);
  if (opts.references) lines.push(`References: ${opts.references}`);
  lines.push('', opts.body);

  const raw = lines.join('\r\n');
  return Buffer.from(raw).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Sends an approved draft via Gmail API, "From" the correct alias.
 *  This is the ONLY function in this module that causes an email to leave
 *  Flowen's control — every caller must have already gone through the
 *  explicit admin approval flow in /admin/inbox. There is no automatic
 *  send path anywhere in this codebase. */
export async function sendAs(opts: {
  fromAlias: string;
  to: string;
  subject: string;
  body: string;
  threadId?: string;
  inReplyToMessageId?: string; // Gmail message id, to fetch Message-ID header for threading
}): Promise<{ id: string; threadId: string }> {
  let inReplyTo: string | undefined;
  let references: string | undefined;
  if (opts.inReplyToMessageId) {
    const original = await getMessage(opts.inReplyToMessageId);
    inReplyTo = getHeader(original.payload, 'Message-ID');
    references = inReplyTo;
  }

  const fromDisplay = FROM[opts.fromAlias as keyof typeof FROM] ?? aliasEmail(opts.fromAlias);
  const raw = buildRawMessage({
    from: fromDisplay,
    to: opts.to,
    subject: opts.subject,
    body: opts.body,
    inReplyTo,
    references,
  });

  const res = await gmailFetch('/messages/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ raw, threadId: opts.threadId }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Gmail send failed: ${res.status} ${err}`);
  }
  return res.json() as Promise<{ id: string; threadId: string }>;
}
