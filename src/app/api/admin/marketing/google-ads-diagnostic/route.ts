import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Diagnostic complete. Permanently disabled; no credentials or APIs accessed.
export async function GET() {
  return new NextResponse(null, {
    status: 404,
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
