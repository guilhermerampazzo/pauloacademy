import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { CheckCircle, ChevronDown, MessageCircle, ShieldCheck } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import Testimonials from '@/components/public/Testimonials'
import CategoryCourses from '@/components/public/CategoryCourses'
import JsonLd from '@/components/JsonLd'
import { getCategories, getContent, getCourses, getTestimonials, defaultOgImage } from '@/lib/data'
import { getCategoryInfo, slugifyCategory, categoryHref, RESERVED_SLUGS, knownCategoryName, GROUP_PAGES } from '@/lib/categories'
import { faqSchema, itemListSchema } from '@/lib/schema'
import { brl, whatsappLink } from '@/lib/site'

// v2: página própria para cada categoria (/eja, /tecnico, /graduacao, /superior, /pos-graduacao).
// Antes o menu apontava para âncoras da home, e 3 delas não existiam.
export const revalidate = 300

type Override = { headline?: string; intro?: string; seo_title?: string; seo_description?: string; faq?: { question: string; answer: string }[] }

async function resolve(slug: string) {
  if (RESERVED_SLUGS.has(slug)) return null
  const categories = await getCategories()
  // v2.4: página de grupo (/eja reúne EJA Ensino Fundamental, EJA Ensino Médio e a categoria antiga "EJA")
  const group = GROUP_PAGES[slug]
  let found: { category: string; count: number; min_price: string | null } | null = null
  let members: string[] = []
  if (group) {
    const inGroup = categories.filter(c => group.categories.includes(c.category))
    const prices = inGroup.map(c => Number(c.min_price || 0)).filter(n => n > 0)
    found = { category: group.name, count: inGroup.reduce((s, c) => s + c.count, 0), min_price: prices.length ? String(Math.min(...prices)) : null }
    members = inGroup.map(c => c.category)
  } else {
    // Categorias do menu abrem mesmo sem cursos ("em breve" + WhatsApp, fora do Google)
    const known = knownCategoryName(slug)
    found = categories.find(c => slugifyCategory(c.category) === slug)
      || (known ? { category: known, count: 0, min_price: null } : null)
    if (found) members = [found.category]
  }
  if (!found) return null
  const content = await getContent()
  const override = (content[`categoria_${slug}`] || {}) as Override
  const info = getCategoryInfo(found.category)
  return {
    ...info,
    headline: override.headline || info.headline,
    intro: override.intro || info.intro,
    seoTitle: override.seo_title || info.seoTitle,
    seoDescription: override.seo_description || info.seoDescription,
    faq: override.faq?.length ? override.faq : info.faq,
    count: found.count,
    minPrice: found.min_price,
    members,
    footer: (content.footer || {}) as Record<string, string>,
  }
}

export async function generateMetadata({ params }: { params: { categoria: string } }): Promise<Metadata> {
  const cat = await resolve(params.categoria)
  if (!cat) return { title: 'Página não encontrada', robots: { index: false } }
  const path = categoryHref(cat.name)
  const ogImage = await defaultOgImage()
  return {
    ...(cat.count === 0 ? { robots: { index: false, follow: true } } : {}),
    title: { absolute: cat.seoTitle },
    description: cat.seoDescription,
    alternates: { canonical: path },
    openGraph: { title: cat.seoTitle, description: cat.seoDescription, url: path, type: 'website', images: [{ url: ogImage, width: 1200, height: 630 }] },
    twitter: { card: 'summary_large_image', title: cat.seoTitle, description: cat.seoDescription, images: [ogImage] },
  }
}

export default async function CategoryPage({ params }: { params: { categoria: string } }) {
  const cat = await resolve(params.categoria)
  if (!cat) notFound()

  const [courses, testimonials] = await Promise.all([
    // v2.4: página de grupo busca os cursos de cada categoria do grupo
    Promise.all(cat.members.map(m => getCourses({ category: m }))).then(l => l.flat()),
    Promise.all((cat.members.length ? cat.members : [cat.name]).map(m => getTestimonials({ category: m, limit: 6 }))).then(l => l.flat().slice(0, 6)),
  ])
  const faq = faqSchema(cat.faq)
  const wa = whatsappLink(cat.footer.whatsapp, `Olá! Estou vendo os cursos de ${cat.label} no site e quero ajuda para escolher.`)

  return (
    <>
      <SiteHeader />

      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: cat.label, path: categoryHref(cat.name) }]} />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10 items-start">
            <div className="lg:col-span-2">
              <h1 className="text-3xl md:text-5xl font-black leading-tight mb-5">{cat.headline}</h1>
              <p className="text-lg text-blue-100 leading-relaxed mb-6">{cat.intro}</p>
              <div className="flex flex-wrap gap-3 text-sm">
                {cat.count > 0 && <span className="bg-white/10 rounded-lg px-3 py-1.5 font-semibold">{cat.count} cursos</span>}
                {cat.minPrice && Number(cat.minPrice) > 0 && (
                  <span className="bg-white/10 rounded-lg px-3 py-1.5">a partir de <strong>{brl(cat.minPrice)}</strong> no PIX</span>
                )}
                <span className="bg-white/10 rounded-lg px-3 py-1.5 flex items-center gap-1"><ShieldCheck size={14} className="text-accent-400" /> Certificado com validade nacional</span>
              </div>
            </div>
            <div className="bg-white text-gray-900 rounded-2xl p-6 shadow-xl">
              <p className="font-bold text-primary-900 mb-2">Não sabe qual escolher?</p>
              <p className="text-sm text-gray-600 mb-4">Um consultor ajuda você a escolher o curso certo para o seu objetivo.</p>
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                <MessageCircle size={18} /> Falar no WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>

      {(cat.audience.length > 0 || cat.benefits.length > 0) && (
        <section className="py-14 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-2 gap-10">
            {cat.audience.length > 0 && (
              <div>
                <h2 className="text-2xl font-bold text-primary-900 mb-5">Para quem é</h2>
                <ul className="space-y-3">
                  {cat.audience.map(a => (
                    <li key={a} className="flex gap-3 text-gray-700"><CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" /> {a}</li>
                  ))}
                </ul>
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-primary-900 mb-5">Por que estudar na Academy Pop</h2>
              <div className="grid gap-4">
                {cat.benefits.map(b => (
                  <div key={b.title} className="p-4 rounded-xl bg-gray-50 border border-gray-100">
                    <p className="font-semibold text-primary-900">{b.title}</p>
                    <p className="text-sm text-gray-600 mt-1">{b.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="py-14 bg-gray-50" id="cursos">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl md:text-3xl font-bold text-primary-900 mb-6">Todos os cursos de {cat.label}</h2>
          {courses.length > 0 ? <CategoryCourses courses={courses} /> : (
            <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center max-w-xl mx-auto">
              <p className="font-semibold text-gray-800">Novos cursos de {cat.label} em breve.</p>
              <p className="text-sm text-gray-500 mt-1 mb-5">Fale com um consultor para conhecer as turmas disponíveis.</p>
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-5 py-3 rounded-lg">
                <MessageCircle size={18} /> Falar no WhatsApp
              </a>
            </div>
          )}
        </div>
      </section>

      <Testimonials items={testimonials} title={`Quem fez ${cat.label} na Academy Pop`} />

      {cat.faq.length > 0 && (
        <section className="py-14 bg-white">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-2xl md:text-3xl font-bold text-primary-900 mb-6">Perguntas frequentes sobre {cat.label}</h2>
            <div className="space-y-3">
              {cat.faq.map((f, i) => (
                <details key={i} className="bg-gray-50 rounded-xl border border-gray-100 group">
                  <summary className="flex items-center justify-between p-5 cursor-pointer select-none font-semibold text-primary-900">
                    {f.question}
                    <ChevronDown size={18} className="text-gray-400 group-open:rotate-180 transition-transform shrink-0 ml-4" />
                  </summary>
                  <div className="px-5 pb-5 text-gray-600 leading-relaxed">{f.answer}</div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      <JsonLd data={itemListSchema(courses, `Cursos de ${cat.label}`)} />
      {faq && <JsonLd data={faq} />}

      <SiteFooter />
      <WhatsAppButton number={cat.footer.whatsapp} context={`os cursos de ${cat.label}`} />
    </>
  )
}
