import type { MetadataRoute } from 'next'
import { SITE_URL } from '@/lib/site'

// v2: antes /robots.txt dava 404
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/api/', '/checkout', '/carrinho'],
    }],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  }
}
