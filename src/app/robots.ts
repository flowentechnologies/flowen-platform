import type { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/admin', '/auth', '/api', '/onboarding', '/telemetry', '/invite', '/api/'],
    },
    sitemap: 'https://flowen.digital/sitemap.xml',
    host: 'https://flowen.digital',
  }
}
