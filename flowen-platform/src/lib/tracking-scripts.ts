export type ProviderKey =
  | 'gtm' | 'ga4' | 'meta' | 'tiktok'
  | 'linkedin' | 'twitter' | 'hotjar' | 'clarity' | 'custom';

export interface ScriptPair {
  head_html: string | null;
  body_html: string | null;
}

// Per-provider pixel ID format rules.  The ID is interpolated directly into
// script string templates, so an unvalidated value could inject arbitrary JS
// or HTML into every page that loads the tracking snippet.
//
// Each regex accepts only the characters the real provider IDs contain — no
// quotes, angle brackets, semicolons, or whitespace — so an XSS payload like
// `');alert(1)//` will be rejected before template interpolation.
const PIXEL_ID_PATTERNS: Partial<Record<ProviderKey, RegExp>> = {
  gtm:      /^GTM-[A-Z0-9]{4,10}$/,
  ga4:      /^G-[A-Z0-9]{8,12}$/,
  meta:     /^\d{10,20}$/,
  tiktok:   /^[A-Z0-9]{15,20}$/i,
  linkedin: /^\d{4,12}$/,
  twitter:  /^[a-z0-9]{5,12}$/i,
  hotjar:   /^\d{4,12}$/,
  clarity:  /^[a-z0-9]{10,15}$/i,
};

/**
 * Generates the head/body HTML snippets for a third-party tracking provider.
 *
 * Returns `{ head_html: null, body_html: null }` if:
 *   - the pixelId fails the per-provider format check (prevents script injection)
 *   - the providerKey is 'custom' or unrecognised
 *
 * Callers should surface an error to the admin UI when null is returned for a
 * non-custom provider, because a format mismatch indicates an invalid ID.
 */
export function generateScripts(providerKey: ProviderKey, pixelId: string): ScriptPair {
  const id = pixelId.trim();

  const pattern = PIXEL_ID_PATTERNS[providerKey];
  if (pattern && !pattern.test(id)) {
    // Invalid format — refuse to interpolate into the script template.
    return { head_html: null, body_html: null };
  }

  switch (providerKey) {
    case 'gtm':      return generateGtm(id);
    case 'ga4':      return generateGa4(id);
    case 'meta':     return generateMeta(id);
    case 'tiktok':   return generateTikTok(id);
    case 'linkedin': return generateLinkedIn(id);
    case 'twitter':  return generateTwitter(id);
    case 'hotjar':   return generateHotjar(id);
    case 'clarity':  return generateClarity(id);
    default:         return { head_html: null, body_html: null };
  }
}

export function providerIdLabel(key: ProviderKey): string {
  const map: Record<ProviderKey, string> = {
    gtm:      'Container ID (e.g. GTM-XXXXXXX)',
    ga4:      'Measurement ID (e.g. G-XXXXXXXXXX)',
    meta:     'Pixel ID (numeric)',
    tiktok:   'Pixel ID (alphanumeric)',
    linkedin: 'Partner ID (numeric)',
    twitter:  'Pixel ID (alphanumeric)',
    hotjar:   'Site ID (numeric)',
    clarity:  'Project ID (alphanumeric)',
    custom:   '',
  };
  return map[key] ?? 'ID';
}

export function providerIdPlaceholder(key: ProviderKey): string {
  const map: Record<ProviderKey, string> = {
    gtm:      'GTM-XXXXXXX',
    ga4:      'G-XXXXXXXXXX',
    meta:     '1234567890',
    tiktok:   'CXXXXXXXXXXXXXXXX',
    linkedin: '123456',
    twitter:  'o12345',
    hotjar:   '1234567',
    clarity:  'abcdefghij',
    custom:   '',
  };
  return map[key] ?? '';
}

function generateGtm(id: string): ScriptPair {
  return {
    head_html: `<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${id}');</script>`,
    body_html: `<noscript><iframe src="https://www.googletagmanager.com/ns.html?id=${id}" height="0" width="0" style="display:none;visibility:hidden"></iframe></noscript>`,
  };
}

function generateGa4(id: string): ScriptPair {
  return {
    head_html: `<script async src="https://www.googletagmanager.com/gtag/js?id=${id}"></script><script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments)}gtag('js',new Date());gtag('config','${id}');</script>`,
    body_html: null,
  };
}

function generateMeta(id: string): ScriptPair {
  return {
    head_html: `<script>!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${id}');fbq('track','PageView');</script>`,
    body_html: `<noscript><img height="1" width="1" style="display:none" src="https://www.facebook.com/tr?id=${id}&ev=PageView&noscript=1"/></noscript>`,
  };
}

function generateTikTok(id: string): ScriptPair {
  return {
    head_html: `<script>!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie","holdConsent","revokeConsent","grantConsent"],ttq.setAndDefer=function(t,e){t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}};for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);ttq.instance=function(t){for(var e=ttq._i[t]||[],n=0;n<ttq.methods.length;n++)ttq.setAndDefer(e,ttq.methods[n]);return e},ttq.load=function(e,n){var r="https://analytics.tiktok.com/i18n/pixel/events.js",o=n&&n.partner;ttq._i=ttq._i||{},ttq._i[e]=[],ttq._i[e]._u=r,ttq._t=ttq._t||{},ttq._t[e]=+new Date,ttq._o=ttq._o||{},ttq._o[e]=n||{};n=document.createElement("script");n.type="text/javascript",n.async=!0,n.src=r+"?sdkid="+e+"&lib="+t;e=document.getElementsByTagName("script")[0];e.parentNode.insertBefore(n,e)};ttq.load('${id}');ttq.page();}(window,document,'ttq');</script>`,
    body_html: null,
  };
}

function generateLinkedIn(id: string): ScriptPair {
  return {
    head_html: `<script>_linkedin_partner_id="${id}";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];window._linkedin_data_partner_ids.push(_linkedin_partner_id);(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";s.parentNode.insertBefore(b,s)})(window.lintrk);</script>`,
    body_html: `<noscript><img height="1" width="1" style="display:none;" alt="" src="https://px.ads.linkedin.com/collect/?pid=${id}&fmt=gif"/></noscript>`,
  };
}

function generateTwitter(id: string): ScriptPair {
  return {
    head_html: `<script>!function(e,t,n,s,u,a){e.twq||(s=e.twq=function(){s.exe?s.exe.apply(s,arguments):s.queue.push(arguments)},s.version='1.1',s.queue=[],u=t.createElement(n),u.async=!0,u.src='https://static.ads-twitter.com/uwt.js',a=t.getElementsByTagName(n)[0],a.parentNode.insertBefore(u,a))}(window,document,'script');twq('config','${id}');</script>`,
    body_html: null,
  };
}

function generateHotjar(id: string): ScriptPair {
  return {
    head_html: `<script>(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};h._hjSettings={hjid:${id},hjsv:6};a=o.getElementsByTagName('head')[0];r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j+h._hjSettings.hjsv;a.appendChild(r);})(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');</script>`,
    body_html: null,
  };
}

function generateClarity(id: string): ScriptPair {
  return {
    head_html: `<script type="text/javascript">(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);})(window,document,"clarity","script","${id}");</script>`,
    body_html: null,
  };
}
