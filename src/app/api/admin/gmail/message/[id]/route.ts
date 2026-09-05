/**
 * GET /api/admin/gmail/message/[id]
 * Ad-hoc diagnostic: fetches one message's full body by Gmail message ID
 * (as returned by /api/admin/gmail/search), for reading things like a
 * bounce notification's actual failure reason.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { getMessage, extractBodyText, getHeader } from '@/lib/gmail';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  const { id } = await params;
  try {
    const msg = await getMessage(id);
    return NextResponse.json({
      from: getHeader(msg.payload, 'From'),
      to: getHeader(msg.payload, 'To'),
      subject: getHeader(msg.payload, 'Subject'),
      date: getHeader(msg.payload, 'Date'),
      snippet: msg.snippet,
      body: extractBodyText(msg.payload),
    });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });
  }
}
