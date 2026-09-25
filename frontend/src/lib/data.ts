// Busca de dados no servidor (Server Components). Tudo com cache/ISR do Next.
import { unstable_noStore as noStore } from 'next/cache'
import type { Course, Testimonial } from '@/types'

const API = process.env.INTERNAL_API_URL || 'http://backend:3001'

// Se a API não responder, a página NÃO é guardada em cache com dados vazios:
// - no "docker build" (API fora do ar) a rota vira dinâmica em vez de estática vazia
//   (antes a home podia ficar sem cursos até o primeiro revalidate após o deploy);
// - numa revalidação em produção, a versão anterior (boa) continua sendo servida.
async function get<T>(path: string, revalidate: number, fallback: T): Promise<T> {
  try {
    const res = await fetch(`${API}${path}`, { next: { revalidate } })
    if (res.status === 404) return fallback
    if (!res.ok) { noStore(); return fallback }
    return (await res.json()) as T
  } catch {
    noStore()
    return fallback
  }
}

export type SiteContent = Record<string, Record<string, unknown>>

export const getContent = () => get<SiteContent>('/content', 300, {})

export interface CategoryCount { category: string; count: number; min_price: string | null }
export const getCategories = () => get<CategoryCount[]>('/courses/categories', 300, [])

export const getCourses = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  return get<Course[]>(`/courses${qs ? `?${qs}` : ''}`, 60, [])
}

export const getCourse = (slug: string) =>
  get<(Course & { related?: Course[] }) | null>(`/courses/slug/${encodeURIComponent(slug)}`, 60, null)

export interface PublicTestimonial extends Testimonial {
  course_title?: string
  course_slug?: string
  category?: string
}
export const getTestimonials = (params: Record<string, string | number> = {}) => {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)])).toString()
  return get<PublicTestimonial[]>(`/content/testimonials/public${qs ? `?${qs}` : ''}`, 120, [])
}

export interface BlogPost {
  id: number
  slug: string
  title: string
  excerpt?: string
  content?: string
  cover_image?: string
  related_category?: string
  author?: string
  published_at?: string
  updated_at?: string
  seo_title?: string
  seo_description?: string
  related_courses?: Course[]
}
export const getPosts = (limit = 24) => get<BlogPost[]>(`/blog?limit=${limit}`, 120, [])
export const getPost = (slug: string) => get<BlogPost | null>(`/blog/slug/${encodeURIComponent(slug)}`, 120, null)

export interface SearchResponse {
  query: string
  total: number
  total_all_categories: number
  facets: Record<string, number>
  fuzzy: boolean
  suggestion: string | null
  results: (Course & { reason?: { type: string; text: string | null } | null })[]
}
export async function searchCourses(params: Record<string, string>): Promise<SearchResponse> {
  const qs = new URLSearchParams(params).toString()
  return get<SearchResponse>(`/search?${qs}`, 30, {
    query: params.q || '', total: 0, total_all_categories: 0, facets: {}, fuzzy: false, suggestion: null, results: [],
  })
}

// v2.4: parcelado sem cartão (TMB) – só o que a página pública precisa saber (sem token nem IDs)
export interface TmbPublic {
  enabled: boolean
  min_value?: number
  categories?: Record<string, { max_parcelas?: number | null; juros_mes?: number | null; entrada_tipo?: 'percentual' | 'valor' | null; entrada_valor?: number | null; parcela_minima?: number | null }>
}
export const getTmbPublic = () => get<TmbPublic>('/tmb/public', 300, { enabled: false })

// v2.4: imagem padrão dos links compartilhados (WhatsApp, Facebook, Instagram).
// Pode ser trocada no painel: Conteúdo > Rastreamento > Imagem de compartilhamento.
export const DEFAULT_OG_IMAGE = '/og-default.jpg'
export async function defaultOgImage(): Promise<string> {
  const content = await getContent()
  const url = String((content.tracking as Record<string, unknown> | undefined)?.og_image || '').trim()
  return url || DEFAULT_OG_IMAGE
}

// v2.4: parceiros (instituições de ensino e empresas/convênios)
export type PartnerType = 'ies' | 'empresa'
export interface Partner {
  id: number
  type: PartnerType
  slug: string
  name: string
  logo?: string | null
  cover_image?: string | null
  summary?: string | null
  content?: string | null
  website?: string | null
  city?: string | null
  state?: string | null
  emec_code?: string | null
  emec_url?: string | null
  accreditation?: string | null
  mec_score?: string | null
  benefit?: string | null
  eligibility?: string | null
  related_category?: string | null
  whatsapp_message?: string | null
  featured?: boolean
  seo_title?: string | null
  seo_description?: string | null
  updated_at?: string
  coupon?: { code: string; discount_percent: number } | null
  related_courses?: Course[]
}
export const PARTNER_TYPE_LABEL: Record<PartnerType, string> = {
  ies: 'Instituição de ensino',
  empresa: 'Empresa e convênio',
}
export const getPartners = (type?: PartnerType) => get<Partner[]>(`/partners${type ? `?type=${type}` : ''}`, 120, [])
export const getPartner = (slug: string) => get<Partner | null>(`/partners/slug/${encodeURIComponent(slug)}`, 120, null)
