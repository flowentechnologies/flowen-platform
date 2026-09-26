/**
 * GET /api/admin/social/meta/check-permissions
 *
 * Meta's Page-posting token is a long-lived Business Manager System User
 * token (regenerated manually in Meta Business Settings, not a redirect-
 * based OAuth flow like Xero/Pinterest — there is no "Connect" button that
 * would make sense here). What an admin actually needs on demand is a way
 * to check what the *currently configured* token can and can't do, since
 * the failure mode that actually hit us (queued Facebook posts failing
 * with "the permission(s) publish_actions are not available — deprecated")
 * doesn't show up in a bare token-validity check (system-health's
 * /me?fields=id call still succeeds fine even missing this permission).
 *
 * Calls Meta's own /me/permissions — the real, current answer, not a guess
 * at what the token should have.
 */
import { NextResponse } from 'next/server';
import { assertAdmin } from '@/lib/admin/guard';
import { isMetaConfigured } from '@/lib/social/meta-publish';

const GRAPH_VERSION = 'v21.0';

// The permission Page-posting actually needs today. publish_actions (what
// queued posts were failing on) was deprecated years ago; pages_manage_posts
// is the current replacement for creating Page content via the Graph API.
const REQUIRED_FOR_POSTING = 'pages_manage_posts';

interface PermissionEntry { permission: string; status: 'granted' | 'declined' | 'expired' }

export async function GET(): Promise<NextResponse> {
  try { await assertAdmin(); } catch { return NextResponse.json({ error: 'Forbidden' }, { status: 403 }); }

  if (!isMetaConfigured()) {
    return NextResponse.json({
      configured: false,
      error: 'META_PAGE_ACCESS_TOKEN / META_PAGE_ID / META_IG_USER_ID not configured',
    }, { status: 422 });
  }

  const token = process.env.META_PAGE_ACCESS_TOKEN;

  try {
    const res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/me/permissions?access_token=${token}`);
    const body = await res.json() as { data?: PermissionEntry[]; error?: { message?: string } };

    if (!res.ok || body.error) {
      return NextResponse.json({
        configured: true,
        tokenValid: false,
        error: body.error?.message ?? `HTTP ${res.status}`,
      }, { status: 502 });
    }

    const permissions = body.data ?? [];
    const granted = permissions.filter(p => p.status === 'granted').map(p => p.permission);
    const hasPostingPermission = granted.includes(REQUIRED_FOR_POSTING);

    return NextResponse.json({
      configured: true,
      tokenValid: true,
      canPostToPages: hasPostingPermission,
      grantedPermissions: granted,
      note: hasPostingPermission
        ? 'Token can post to Pages.'
        : `Missing ${REQUIRED_FOR_POSTING} — this is why queued Facebook posts are failing. Regenerate the System User token in Meta Business Settings > System Users, granting ${REQUIRED_FOR_POSTING} (and pages_read_engagement, pages_show_list) explicitly, then update META_PAGE_ACCESS_TOKEN in Vercel.`,
    });
  } catch (err) {
    return NextResponse.json({
      configured: true,
      tokenValid: false,
      error: err instanceof Error ? err.message : String(err),
    }, { status: 502 });
  }
}
