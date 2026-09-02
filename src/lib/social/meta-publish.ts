/**
 * Meta Graph API publishing — Instagram + Facebook.
 *
 * This is the only auto-publish path in the social queue. Both platforms
 * are covered by one Meta Business app because posting to your own Page/
 * IG Business account (as opposed to other people's) does not require the
 * lengthy App Review process — only accounts with a role in the same
 * Business Manager as the app can be posted to while the app is in
 * Development Mode. See /admin/social for the human-facing side of this;
 * LinkedIn is deliberately NOT here — Company Page auto-posting requires
 * LinkedIn's Marketing Developer Platform, which is enterprise-gated.
 *
 * Env vars required (all read lazily — see isMetaConfigured()):
 *   META_PAGE_ACCESS_TOKEN — long-lived Page access token (does not expire
 *     on its own as long as the token isn't revoked; see Meta's docs on
 *     exchanging a long-lived User token for a Page token)
 *   META_PAGE_ID           — the Facebook Page ID
 *   META_IG_USER_ID        — the linked Instagram Business/Creator account ID
 */

const GRAPH_VERSION = 'v21.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export function isMetaConfigured(): boolean {
  return Boolean(
    process.env.META_PAGE_ACCESS_TOKEN &&
    process.env.META_PAGE_ID &&
    process.env.META_IG_USER_ID,
  );
}

interface GraphError {
  error?: { message?: string; type?: string; code?: number; error_subcode?: number };
}

async function graphFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const url = new URL(`${GRAPH_BASE}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

  const res = await fetch(url.toString(), { method: 'POST' });
  const body = await res.json() as T & GraphError;

  if (!res.ok || body.error) {
    const msg = body.error?.message ?? `Graph API error (HTTP ${res.status})`;
    throw new Error(msg);
  }
  return body;
}

/**
 * Publish a single image to Instagram via the two-step container flow:
 * create a media container, then publish it. imageUrl must be publicly
 * reachable (Meta's servers fetch it directly).
 */
export async function publishToInstagram(opts: {
  imageUrl: string;
  caption: string;
}): Promise<{ mediaId: string }> {
  const igUserId = process.env.META_IG_USER_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const container = await graphFetch<{ id: string }>(`${igUserId}/media`, {
    image_url: opts.imageUrl,
    caption: opts.caption,
    access_token: accessToken,
  });

  const published = await graphFetch<{ id: string }>(`${igUserId}/media_publish`, {
    creation_id: container.id,
    access_token: accessToken,
  });

  return { mediaId: published.id };
}

/** Publish a single image to a Facebook Page in one call. */
export async function publishToFacebook(opts: {
  imageUrl: string;
  caption: string;
}): Promise<{ postId: string }> {
  const pageId = process.env.META_PAGE_ID!;
  const accessToken = process.env.META_PAGE_ACCESS_TOKEN!;

  const result = await graphFetch<{ id: string; post_id?: string }>(`${pageId}/photos`, {
    url: opts.imageUrl,
    caption: opts.caption,
    access_token: accessToken,
  });

  return { postId: result.post_id ?? result.id };
}
