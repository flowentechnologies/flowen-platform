/**
 * GET /api/admin/gmail/search?q=<gmail search query>
 *
 * Ad-hoc diagnostic: searches the connected mailbox with a raw Gmail
 * search query, unlike the regular sync worker which deliberately
 * excludes Trash and (unless queried) most system mail — useful for
 * "did this email actually arrive anywhere" questions, e.g. a Google
 * verification email that isn't showing up where expected. Defaults to
 * `in:anywhere` (all mail + spam + trash) if no `in:` term is given.
 */
import { NextRequest, NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { getValidAccessToken, getHeader, type GmailMessageMeta } from '@/lib/gmail';

export async function GET(req: NextRequest): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const q = new URL(req.url).searchParams.get('q');
  if (!q) return NextResponse.json({ error: 'q parameter required' }, { status: 400 });

  const token = await getValidAccessToken();
  if (!token) return NextResponse.json({ error: 'Gmail not connected' }, { status: 400 });

  const finalQuery = /\bin:/.test(q) ? q : `${q} in:anywhere`;
  const listRes = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/messages?maxResults=20&q=${encodeURIComponent(finalQuery)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  const listBody = await listRes.json() as { messages?: { id: string }[]; error?: unknown };
  if (!listRes.ok) return NextResponse.json({ error: 'Gmail search failed', detail: listBody.error }, { status: 500 });

  const messages = listBody.messages ?? [];
  const results = await Promise.all(messages.map(async ({ id }) => {
    const res = await fetch(
      `https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Delivered-To`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const msg = await res.json() as GmailMessageMeta;
    return {
      id: msg.id,
      labelIds: msg.labelIds ?? [],
      from: getHeader(msg.payload, 'From'),
      subject: getHeader(msg.payload, 'Subject'),
      deliveredTo: getHeader(msg.payload, 'Delivered-To'),
      date: msg.internalDate ? new Date(Number(msg.internalDate)).toISOString() : null,
    };
  }));

  return NextResponse.json({ query: finalQuery, count: results.length, messages: results });
}
