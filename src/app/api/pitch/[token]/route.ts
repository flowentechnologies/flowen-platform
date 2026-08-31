import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { headers } from 'next/headers';
import { adminDb as db } from '@/lib/supabase/admin';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const client = db();

  const { data: invite, error } = await client
    .from('deck_invites')
    .select('id, revoked, expires_at, view_count')
    .eq('token', token)
    .single();

  if (error || !invite) {
    return new NextResponse(errorPage('Link not found', 'This pitch deck link is invalid.'), {
      status: 404, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (invite.revoked) {
    return new NextResponse(errorPage('Link revoked', 'This link has been revoked by Flowen.'), {
      status: 403, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new NextResponse(errorPage('Link expired', 'This pitch deck link has expired.'), {
      status: 410, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  // Log view (fire-and-forget — don't block the response)
  const headerList = await headers();
  const ip = headerList.get('x-forwarded-for')?.split(',')[0] ?? null;
  const ua = headerList.get('user-agent') ?? null;

  // Fire-and-forget view tracking — does not block the response.
  // view_count is incremented atomically via an RPC to avoid a read-modify-write
  // race where two concurrent requests could both read the same count and write
  // the same incremented value, losing one increment.
  Promise.all([
    client.from('deck_views').insert({ invite_id: invite.id, ip_address: ip, user_agent: ua }),
    client.rpc('increment_deck_view_count', {
      p_invite_id: invite.id,
      p_last_viewed_at: new Date().toISOString(),
    }),
  ]).catch(() => {/* ignore tracking errors */});

  try {
    // Use async readFile (fs/promises) — readFileSync blocks the event loop for
    // the duration of the disk read, which can delay concurrent requests sharing
    // the same Fluid Compute instance.
    // private/ is NOT served by Next.js static asset handler — only public/ is.
    // deck.html is intentionally kept outside public/ so it cannot be accessed
    // directly at /deck.html; it is only served through this token-gated route.
    const html = await readFile(join(process.cwd(), 'private', 'deck.html'), 'utf8');
    // The deck uses Tailwind CDN, Google Fonts, and FontAwesome — set a
    // permissive CSP scoped to this route only.  This overrides the site-wide
    // restrictive CSP set in next.config.ts for all other routes.
    const deckCSP = [
      `default-src 'self'`,
      `script-src 'self' 'unsafe-inline' https://cdn.tailwindcss.com https://cdnjs.cloudflare.com`,
      `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdnjs.cloudflare.com`,
      `font-src 'self' data: https://fonts.gstatic.com https://cdnjs.cloudflare.com`,
      `img-src 'self' data: blob: https:`,
      `connect-src 'self'`,
      `media-src 'self' blob:`,
      `object-src 'none'`,
      `base-uri 'self'`,
    ].join('; ');

    return new NextResponse(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Security-Policy': deckCSP,
      },
    });
  } catch {
    return new NextResponse(errorPage('Deck unavailable', 'The pitch deck file is not configured yet.'), {
      status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }
}

function errorPage(title: string, message: string) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Flowen — ${title}</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0C0E1A;color:#F5F3EE;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:2rem}.card{background:#14172E;border:1px solid rgba(245,243,238,0.08);border-radius:16px;padding:3rem 2.5rem;max-width:440px;text-align:center}.logo{font-size:2rem;margin-bottom:1.5rem}.title{font-size:1.5rem;font-weight:700;margin-bottom:0.75rem;color:#E2703A}.msg{font-size:0.9rem;color:#A6A3BE;line-height:1.6}.foot{margin-top:2rem;font-size:0.75rem;color:#6E6C88;font-family:monospace}</style></head><body><div class="card"><div class="logo">〜</div><p class="title">${title}</p><p class="msg">${message}</p><p class="foot">flowen.digital · CONFIDENTIAL</p></div></body></html>`;
}
