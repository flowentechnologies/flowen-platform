import type { MetadataRoute } from 'next'

const BASE_URL = 'https://flowen.digital'
const LAST_MODIFIED = new Date('2026-08-01')

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: BASE_URL,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/pricing`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/resources`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'weekly',
      priority: 0.7,
    },
    {
      url: `${BASE_URL}/faq`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${BASE_URL}/security`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${BASE_URL}/media-kit`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${BASE_URL}/legal`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/accessibility`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/cookie-policy`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.4,
    },
    {
      url: `${BASE_URL}/waitlist`,
      lastModified: LAST_MODIFIED,
      changeFrequency: 'monthly',
      priority: 0.7,
    },
  ]
}
