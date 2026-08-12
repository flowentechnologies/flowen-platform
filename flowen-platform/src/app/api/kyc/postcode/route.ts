import { NextRequest, NextResponse } from 'next/server';

// UK postcode regex (loose — Postcodes.io is the authority on validity)
const UK_POSTCODE_RE = /^[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}$/i;

interface PostcodesIoResult {
  postcode: string;
  region: string | null;
  admin_county: string | null;
  admin_district: string | null;
  country: string;
  longitude: number | null;
  latitude: number | null;
}

interface PostcodesIoResponse {
  status: number;
  result: PostcodesIoResult | null;
}

export interface PostcodeLookupResponse {
  valid: true;
  postcode: string;         // normalised with space e.g. "SW1A 1AA"
  region: string | null;
  district: string | null;
  country: string;
}

export interface PostcodeLookupError {
  valid: false;
  error: string;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const raw = req.nextUrl.searchParams.get('postcode') ?? '';
  const cleaned = raw.trim().toUpperCase().replace(/\s+/g, '');

  if (!cleaned) {
    return NextResponse.json<PostcodeLookupError>(
      { valid: false, error: 'Postcode is required' },
      { status: 400 },
    );
  }

  if (!UK_POSTCODE_RE.test(cleaned)) {
    return NextResponse.json<PostcodeLookupError>(
      { valid: false, error: 'That doesn\'t look like a valid UK postcode' },
      { status: 422 },
    );
  }

  let res: Response;
  try {
    res = await fetch(`https://api.postcodes.io/postcodes/${encodeURIComponent(cleaned)}`, {
      // Next.js cache: postcodes don't change often; cache for 24 h
      next: { revalidate: 86400 },
    } as RequestInit);
  } catch {
    return NextResponse.json<PostcodeLookupError>(
      { valid: false, error: 'Could not reach postcode service — please enter your address manually' },
      { status: 503 },
    );
  }

  if (res.status === 404) {
    return NextResponse.json<PostcodeLookupError>(
      { valid: false, error: 'Postcode not found — please check and try again' },
      { status: 422 },
    );
  }

  if (!res.ok) {
    return NextResponse.json<PostcodeLookupError>(
      { valid: false, error: 'Postcode lookup failed — please enter your address manually' },
      { status: 502 },
    );
  }

  const json: PostcodesIoResponse = await res.json();
  const r = json.result;

  if (!r) {
    return NextResponse.json<PostcodeLookupError>(
      { valid: false, error: 'Postcode not found — please check and try again' },
      { status: 422 },
    );
  }

  // Normalise to "AB1 2CD" format (insert space before last 3 chars)
  const norm = cleaned.length > 3
    ? `${cleaned.slice(0, -3)} ${cleaned.slice(-3)}`
    : cleaned;

  // For Scotland/Wales/NI, Postcodes.io returns null for region — fall back to district
  const displayRegion = r.region ?? r.admin_district;

  return NextResponse.json<PostcodeLookupResponse>({
    valid: true,
    postcode: norm,
    region: displayRegion,
    district: r.admin_district,
    country: r.country,
  });
}
