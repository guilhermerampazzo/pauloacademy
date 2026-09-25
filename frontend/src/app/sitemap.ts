import type { MetadataRoute } from 'next'
import { unstable_noStore as noStore } from 'next/cache'
import { SITE_URL } from '@/lib/site'
import { categoryHref, GROUP_PAGES } from '@/lib/categories'

// v2: antes /sitemap.xml dava 404. Gerado a partir do banco (cursos, categorias e posts),
// atualizado a cada hora.
export const revalidate = 3600

const API = process.env.INTERNAL_API_URL || 'http://backend:3001'

async function get<T>(path: string, fallback: T): Promise<T> {
  try {
    const r = await fetch(`${API}${path}`, { next: { revalidate: 3600 } })
    if (!r.ok) { noStore(); return fallback }
    return await r.json()
  } catch { noStore(); return fallback }
}

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [courses, categories, posts] = await Promise.all([
    get<{ slug: string; updated_at: string }[]>('/courses/sitemap', []),
    get<{ category: string }[]>('/courses/categories', []),
    get<{ slug: string; updated_at?: string; published_at?: string }[]>('/blog?limit=100', []),
  ])
  // v2.4: parceiros
  const partners = await get<{ slug: string; updated_at?: string }[]>('/partners', [])
  const now = new Date()

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/cursos`, lastModified: now, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/como-funciona`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/reconhecimento-mec`, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${SITE_URL}/sobre-nos`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/perguntas-frequentes`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/blog`, changeFrequency: 'weekly', priority: 0.6 },
    ...(partners.length ? [{ url: `${SITE_URL}/parceiros`, changeFrequency: 'monthly' as const, priority: 0.5 }] : []),
    { url: `${SITE_URL}/politica-de-privacidade`, changeFrequency: 'yearly', priority: 0.2 },
    { url: `${SITE_URL}/termos-de-uso`, changeFrequency: 'yearly', priority: 0.2 },
  ]

  // v2.4: páginas de grupo (/eja) entram quando alguma categoria do grupo tem cursos
  const catNames = new Set(categories.map(c => c.category))
  const groupPages = Object.entries(GROUP_PAGES)
    .filter(([slug, g]) => g.categories.some(n => catNames.has(n)) && !categories.some(c => categoryHref(c.category) === `/${slug}`))
    .map(([slug]) => ({ url: `${SITE_URL}/${slug}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 }))

  return [
    ...staticPages,
    ...groupPages,
    ...categories.map(c => ({ url: `${SITE_URL}${categoryHref(c.category)}`, lastModified: now, changeFrequency: 'weekly' as const, priority: 0.9 })),
    ...courses.map(c => ({ url: `${SITE_URL}/cursos/${c.slug}`, lastModified: c.updated_at ? new Date(c.updated_at) : now, changeFrequency: 'weekly' as const, priority: 0.8 })),
    ...partners.map(p => ({ url: `${SITE_URL}/parceiros/${p.slug}`, lastModified: p.updated_at ? new Date(p.updated_at) : now, changeFrequency: 'monthly' as const, priority: 0.5 })),
    ...posts.map(p => ({ url: `${SITE_URL}/blog/${p.slug}`, lastModified: new Date(p.updated_at || p.published_at || now), changeFrequency: 'monthly' as const, priority: 0.6 })),
  ]
}
