import type { MetadataRoute } from 'next'

const BASE_URL = 'https://flowen.digital'

// Use today's date at build time so the sitemap stays fresh on each deploy
const now = new Date()

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    // ── Core marketing ────────────────────────────────────────────────────
    {
      url: BASE_URL,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/how-it-works`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },

    // ── Audience-specific ─────────────────────────────────────────────────
    {
      url: `${BASE_URL}/clinicians`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/nhs-framework`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/affiliates`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Resources ─────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/resources`,
      lastModified: now,
      changeFrequency: 'weekly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/resources/easy-onset-techniques`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/resources/biofeedback-evidence`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/resources/access-to-work`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/resources/dsa-guide`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/resources/nhs-procurement`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/whitepaper`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },

    // ── Training ──────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/training`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/training/clinicians`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/training/nhs`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/training/staff`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // ── Support & trust ───────────────────────────────────────────────────
    {
      url: `${BASE_URL}/support`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/security`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/media-kit`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },

    // ── Legal ─────────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/legal`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/accessibility`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/cookie-policy`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/dpa`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.4,
    },

    // ── Conversion ────────────────────────────────────────────────────────
    {
      url: `${BASE_URL}/waitlist`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
