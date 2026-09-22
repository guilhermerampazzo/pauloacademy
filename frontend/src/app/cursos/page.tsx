import type { Metadata } from 'next'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import SearchBox from '@/components/public/SearchBox'
import CourseCard from '@/components/public/CourseCard'
import CatalogFilters from '@/components/public/CatalogFilters'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import { getCategories, getContent, searchCourses } from '@/lib/data'
import { getCategoryInfo } from '@/lib/categories'
import { whatsappLink } from '@/lib/site'
import type { Course } from '@/types'

// v2: catálogo completo + página de resultados da busca (/cursos?q=...)
const PAGE_SIZE = 24
type SP = Record<string, string | string[] | undefined>
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || ''

export async function generateMetadata({ searchParams }: { searchParams: SP }): Promise<Metadata> {
  const q = one(searchParams.q)
  const filtered = q || one(searchParams.categoria) || one(searchParams.ordem) || one(searchParams.pagina)
  return {
    title: q ? `Busca: ${q}` : 'Todos os cursos EAD',
    description: 'Encontre seu curso EAD: EJA, técnico, graduação e pós-graduação com certificado de validade nacional.',
    alternates: { canonical: '/cursos' },
    // resultados de busca e filtros não entram no Google (evita páginas duplicadas)
    robots: filtered ? { index: false, follow: true } : undefined,
  }
}

export default async function CursosPage({ searchParams }: { searchParams: SP }) {
  const q = one(searchParams.q)
  const categoria = one(searchParams.categoria)
  const ordem = one(searchParams.ordem) || (q ? 'relevance' : 'relevance')
  const precoMax = one(searchParams.preco_max)
  const page = Math.max(parseInt(one(searchParams.pagina)) || 1, 1)

  const params: Record<string, string> = { limit: String(PAGE_SIZE), offset: String((page - 1) * PAGE_SIZE), ordem }
  if (q) params.q = q
  if (categoria) params.categoria = categoria
  if (precoMax) params.preco_max = precoMax

  const [data, categories, content] = await Promise.all([searchCourses(params), getCategories(), getContent()])
  const footer = (content.footer || {}) as Record<string, string>
  const pages = Math.ceil(data.total / PAGE_SIZE)

  const facets = q
    ? Object.entries(data.facets).map(([category, count]) => ({ category, count }))
    : categories.map(c => ({ category: c.category, count: c.count }))

  const linkFor = (p: number) => {
    const sp = new URLSearchParams()
    if (q) sp.set('q', q)
    if (categoria) sp.set('categoria', categoria)
    if (ordem && ordem !== 'relevance') sp.set('ordem', ordem)
    if (precoMax) sp.set('preco_max', precoMax)
    if (p > 1) sp.set('pagina', String(p))
    const s = sp.toString()
    return `/cursos${s ? `?${s}` : ''}`
  }

  return (
    <>
      <SiteHeader />
      <section className="relative z-20 bg-gradient-to-br from-primary-900 to-primary-800 text-white pt-10 pb-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: 'Cursos', path: '/cursos' }]} />
          <h1 className="text-3xl md:text-4xl font-black mb-6">
            {q ? <>Resultados para “{q}”</> : 'Todos os cursos'}
          </h1>
          <div className="max-w-2xl">
            <SearchBox variant="page" initialQuery={q} categories={categories} whatsapp={footer.whatsapp} key={q} />
          </div>
        </div>
      </section>

      <section className="py-10 bg-gray-50 min-h-[50vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <CatalogFilters facets={facets} total={q ? data.total_all_categories : categories.reduce((s, c) => s + c.count, 0)}
            categoria={categoria} ordem={ordem} precoMax={precoMax} />

          {data.suggestion && (
            <p className="mb-4 text-gray-700">
              Você quis dizer <Link href={`/cursos?q=${encodeURIComponent(data.suggestion)}`} className="font-semibold text-accent-700 underline">{data.suggestion}</Link>?
            </p>
          )}

          <p className="text-sm text-gray-500 mb-5">
            {data.total} curso(s){categoria ? ` em ${getCategoryInfo(categoria).label}` : ''}{pages > 1 ? ` · página ${page} de ${pages}` : ''}
          </p>

          {data.results.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {data.results.map((c, i) => <CourseCard key={c.id} course={c as Course} priority={i < 3} />)}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-xl mx-auto">
              <p className="font-semibold text-gray-800">Nenhum curso encontrado{q ? ` para “${q}”` : ''}.</p>
              <p className="text-sm text-gray-500 mt-1 mb-5">Temos cursos que não estão no site. Pergunte a um consultor:</p>
              <a href={whatsappLink(footer.whatsapp, `Olá! Procurei por "${q}" no site e não encontrei. Vocês têm esse curso?`)} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-lg">
                <MessageCircle size={18} /> Perguntar no WhatsApp
              </a>
            </div>
          )}

          {pages > 1 && (
            <nav className="flex flex-wrap justify-center gap-2 mt-10" aria-label="Paginação">
              {page > 1 && <Link href={linkFor(page - 1)} className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm hover:border-gray-300">← Anterior</Link>}
              {Array.from({ length: pages }, (_, i) => i + 1).filter(p => Math.abs(p - page) <= 2 || p === 1 || p === pages).map(p => (
                <Link key={p} href={linkFor(p)} aria-current={p === page ? 'page' : undefined}
                  className={`px-4 py-2 rounded-lg text-sm border ${p === page ? 'bg-primary-900 text-white border-primary-900' : 'bg-white border-gray-200 hover:border-gray-300'}`}>{p}</Link>
              ))}
              {page < pages && <Link href={linkFor(page + 1)} className="px-4 py-2 rounded-lg bg-white border border-gray-200 text-sm hover:border-gray-300">Próxima →</Link>}
            </nav>
          )}
        </div>
      </section>
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context={q ? `a busca por "${q}"` : 'o catálogo de cursos'} />
    </>
  )
}
