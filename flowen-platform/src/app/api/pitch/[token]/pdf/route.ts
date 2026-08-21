import { NextResponse } from 'next/server';
import { adminDb as db } from '@/lib/supabase/admin';
import { buildPitchPDF } from '@/lib/pitch-pdf';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const client = db();

  const { data: invite, error } = await client
    .from('deck_invites')
    .select('id, revoked, expires_at')
    .eq('token', token)
    .single();

  if (error || !invite) {
    return new NextResponse('Link not found', { status: 404 });
  }

  if (invite.revoked) {
    return new NextResponse('Link revoked', { status: 403 });
  }

  if (invite.expires_at && new Date(invite.expires_at) < new Date()) {
    return new NextResponse('Link expired', { status: 410 });
  }

  try {
    const pdf = await buildPitchPDF();

    return new NextResponse(pdf.buffer as ArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'attachment; filename="Flowen-Investor-Deck.pdf"',
        'Cache-Control': 'private, no-store',
        'X-Robots-Tag': 'noindex, nofollow',
        'Content-Length': String(pdf.length),
      },
    });
  } catch (err) {
    console.error('[pitch/pdf] PDF generation failed:', err);
    return new NextResponse('PDF generation failed', { status: 500 });
  }
}
