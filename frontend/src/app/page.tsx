import type { Metadata } from 'next'
import { Award, Monitor, Clock, HeadphonesIcon, ChevronRight, Star, CheckCircle, Users, ArrowRight, ShieldCheck, BookOpen, Check } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import CourseCard from '@/components/public/CourseCard'
import SearchBox from '@/components/public/SearchBox'
import Testimonials from '@/components/public/Testimonials'
import { getCategories, getContent, getCourses, getTestimonials, getPosts } from '@/lib/data'
import { getCategoryInfo, categoryHref, sortCategories } from '@/lib/categories'
import { brl, whatsappLink } from '@/lib/site'
import type { Course } from '@/types'

export const revalidate = 60

export const metadata: Metadata = {
  alternates: { canonical: '/' },
}

const ICON_MAP: Record<string, React.ReactNode> = {
  award: <Award size={20} />,
  monitor: <Monitor size={20} />,
  clock: <Clock size={20} />,
  headphones: <HeadphonesIcon size={20} />,
  check: <CheckCircle size={20} />,
  star: <Star size={20} />,
  users: <Users size={20} />,
  book: <BookOpen size={20} />,
}

const PER_CATEGORY = 6

export default async function HomePage() {
  // v2: a home carrega no máximo 6 cursos por categoria (antes: os 201 cursos,
  // 1,7 MB de HTML). O restante fica nas páginas de categoria e em /cursos.
  const [courses, content, categories, testimonials, posts] = await Promise.all([
    getCourses({ per_category: PER_CATEGORY }),
    getContent(),
    getCategories(),
    getTestimonials({ limit: 6 }),
    getPosts(3),
  ])
  const hero = (content.hero || {}) as Record<string, unknown>
  const benefits = ((content.benefits as Record<string, unknown>)?.items || []) as { icon: string; text: string }[]
  const about = (content.about || {}) as Record<string, unknown>
  const footer = (content.footer || {}) as Record<string, string>
  const howItWorks = (content.como_funciona || {}) as { title?: string; steps?: { title: string; text: string }[] }

  const totalCourses = categories.reduce((s, c) => s + c.count, 0)
  const sortedCategories = sortCategories(categories)

  // Provas do hero (editáveis em Conteúdo > Hero). Padrão: dados que o próprio site já informa.
  const proofItems = (Array.isArray(hero.proof_items) && (hero.proof_items as string[]).filter(Boolean).length
    ? (hero.proof_items as string[]).filter(Boolean)
    : ['Polo oficial parceiro do Grupo LA Educação e do Grupo UNICORP', 'Certificados com validade nacional', 'Atendimento humano desde 2019'])

  const replaceTokens = (v: string) => String(v).replace(/\{total_cursos\}/g, String(totalCourses))

  return (
    <>
      <SiteHeader />

      {/* Hero – v2: prova no topo, busca em destaque e dois caminhos claros */}
      {/* sem overflow-hidden na seção: a lista da busca precisa "vazar" para baixo */}
      <section className="relative z-20 bg-gradient-to-br from-primary-900 via-primary-800 to-primary-700 text-white">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          {hero.background_image ? (
            <>
              <Image src={String(hero.background_image)} alt="" fill priority sizes="100vw" className="object-cover" />
              <div className="absolute inset-0 bg-gradient-to-r from-primary-950/95 via-primary-900/85 to-primary-900/50" />
            </>
          ) : (
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-20 right-20 w-96 h-96 bg-accent-500 rounded-full blur-3xl" />
              <div className="absolute bottom-10 left-10 w-64 h-64 bg-blue-400 rounded-full blur-3xl" />
            </div>
          )}
        </div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14 pb-16 md:pt-20 md:pb-24 lg:grid lg:grid-cols-[1fr_320px] lg:gap-12 lg:items-center">
          <div className="max-w-3xl">
            {hero.badge_text ? (
              <div className="inline-flex items-center gap-2 bg-accent-500/20 border border-accent-400/30 text-accent-200 text-sm font-semibold px-4 py-1.5 rounded-full mb-5">
                <Star size={14} className="fill-accent-400 text-accent-400" />
                {String(hero.badge_text)}
              </div>
            ) : null}
            <h1 className="text-3xl sm:text-4xl md:text-5xl font-black leading-[1.1] mb-5 text-balance">
              {String(hero.headline || 'Seu diploma reconhecido pelo MEC, 100% online')}
            </h1>
            <p className="text-lg md:text-xl text-blue-100 mb-7 leading-relaxed whitespace-pre-line">
              {String(hero.subheadline || 'EJA, cursos técnicos, graduação e pós-graduação com certificado de validade nacional.')}
            </p>

            <div className="max-w-2xl mb-6">
              <SearchBox variant="hero" categories={categories} whatsapp={footer.whatsapp} />
            </div>

            <ul className="flex flex-col sm:flex-row sm:flex-wrap gap-x-6 gap-y-2 text-sm text-blue-100 mb-8">
              {proofItems.map(p => (
                <li key={p} className="flex items-center gap-2"><ShieldCheck size={16} className="text-accent-400 shrink-0" /> {p}</li>
              ))}
            </ul>

            <div className="flex flex-col sm:flex-row gap-3">
              <a href="#categorias" className="btn-primary text-base px-7 py-3.5 justify-center">
                {String(hero.cta_text || 'Escolher meu curso')} <ChevronRight size={20} />
              </a>
              <a href={whatsappLink(footer.whatsapp, 'Olá! Vim pelo site e quero ajuda para escolher meu curso.')}
                target="_blank" rel="noopener noreferrer" className="btn-outline text-base px-7 py-3.5 justify-center">
                Falar com consultor
              </a>
            </div>
          </div>

          {/* Números (Conteúdo > Sobre a Plataforma > Estatísticas) */}
          {Array.isArray(about.stats) && (about.stats as unknown[]).length > 0 && (
            <div className="hidden lg:grid grid-cols-2 gap-3">
              {(about.stats as Array<{ value: string; label: string }>).slice(0, 4).map((st, i) => (
                <div key={i} className="rounded-2xl bg-white/10 backdrop-blur border border-white/10 p-5 text-center">
                  <p className="text-3xl font-black text-accent-300">{replaceTokens(st.value)}</p>
                  <p className="text-xs text-blue-100 mt-1">{st.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Benefícios */}
      {benefits.length > 0 && (
        <section className="bg-primary-800 text-white py-4">
          <div className="max-w-7xl mx-auto px-4">
            <div className="flex flex-wrap justify-center gap-x-10 gap-y-3">
              {benefits.map((b, i) => (
                <div key={i} className="flex items-center gap-2 text-sm font-medium text-blue-100">
                  <span className="text-accent-400">{ICON_MAP[b.icon] || <CheckCircle size={20} />}</span>
                  {b.text}
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Categorias – v2: cada tipo de curso tem página própria */}
      {sortedCategories.length > 0 && (
        <section id="categorias" className="py-16 md:py-20 bg-white scroll-mt-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="section-title">Qual é o seu próximo passo?</h2>
              <p className="section-subtitle !mb-0">Escolha o tipo de curso. São {totalCourses} opções 100% online.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              {sortedCategories.map(c => {
                const info = getCategoryInfo(c.category)
                return (
                  <Link key={c.category} href={categoryHref(c.category)}
                    className="group rounded-2xl border-2 border-gray-100 hover:border-accent-400 p-5 transition-all hover:shadow-lg flex flex-col">
                    <span className="text-xs font-semibold text-accent-700 uppercase tracking-wide">{c.count} cursos</span>
                    <span className="text-xl font-black text-primary-900 mt-1">{info.label}</span>
                    <span className="text-sm text-gray-500 mt-2 line-clamp-3 flex-1">{info.audience[0] || info.intro}</span>
                    {c.min_price && Number(c.min_price) > 0 && (
                      <span className="text-sm text-gray-700 mt-3">a partir de <strong>{brl(c.min_price)}</strong></span>
                    )}
                    <span className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 group-hover:gap-2 transition-all">
                      Ver cursos <ArrowRight size={16} />
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        </section>
      )}

      {/* Cursos em destaque por categoria */}
      <section id="cursos" className="py-16 md:py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="section-title">Cursos em destaque</h2>
            <p className="section-subtitle !mb-0">Os mais procurados de cada área. Comece hoje mesmo.</p>
          </div>

          {sortedCategories.map(({ category, count }) => {
            const catCourses = (courses as Course[]).filter(c => c.category === category)
            if (!catCourses.length) return null
            const info = getCategoryInfo(category)
            return (
              <div key={category} id={`cursos-${info.slug}`} className="mb-16 scroll-mt-24">
                <div className="flex items-center gap-3 mb-6">
                  <h3 className="text-2xl font-bold text-primary-900">{info.label}</h3>
                  <div className="flex-1 h-px bg-gray-200" />
                  <Link href={categoryHref(category)} className="text-sm font-semibold text-accent-700 hover:underline whitespace-nowrap">
                    Ver todos ({count}) →
                  </Link>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {catCourses.map(course => <CourseCard key={course.id} course={course} />)}
                </div>
              </div>
            )
          })}

          {courses.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Monitor size={48} className="mx-auto mb-4 opacity-40" />
              <p>Cursos em breve. Entre em contato!</p>
            </div>
          )}
        </div>
      </section>

      <Testimonials items={testimonials} subtitle="Histórias de quem estudou com a Academy Pop" />

      {/* Como funciona (resumo) */}
      {howItWorks.steps && howItWorks.steps.length > 0 && (
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="section-title">{howItWorks.title || 'Como funciona'}</h2>
            </div>
            <ol className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-6">
              {howItWorks.steps.slice(0, 5).map((s, i) => (
                <li key={i} className="relative p-5 rounded-2xl bg-gray-50 border border-gray-100">
                  <span className="w-9 h-9 rounded-full bg-accent-500 text-white font-bold flex items-center justify-center mb-3">{i + 1}</span>
                  <p className="font-bold text-primary-900 mb-1">{s.title}</p>
                  <p className="text-sm text-gray-600">{s.text}</p>
                </li>
              ))}
            </ol>
            <div className="text-center mt-8">
              <Link href="/como-funciona" className="text-accent-700 font-semibold hover:underline">Entenda cada etapa →</Link>
            </div>
          </div>
        </section>
      )}

      {/* Sobre */}
      {about.title ? (
        <section className="py-16 md:py-20 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-16 items-center">
              <div>
                <h2 className="section-title">{String(about.title)}</h2>
                <p className="text-gray-600 text-lg leading-relaxed mb-8">{String(about.text || '')}</p>
                {Array.isArray(about.stats) && (
                  <div className="grid grid-cols-2 gap-4">
                    {(about.stats as Array<{ value: string; label: string }>).map((s, i) => (
                      <div key={i} className="text-center p-4 bg-white rounded-xl border border-gray-100">
                        <p className="text-3xl font-black text-accent-600">{replaceTokens(s.value)}</p>
                        <p className="text-sm text-gray-600 mt-1">{s.label}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex flex-wrap gap-4 mt-8 text-sm">
                  <Link href="/reconhecimento-mec" className="inline-flex items-center gap-1 font-semibold text-primary-800 hover:text-accent-700"><Check size={16} /> Reconhecimento MEC</Link>
                  <Link href="/sobre-nos" className="inline-flex items-center gap-1 font-semibold text-primary-800 hover:text-accent-700"><Check size={16} /> Nossa história</Link>
                </div>
              </div>
              <div className="relative">
                {about.image ? (
                  <Image src={String(about.image)} alt={String(about.title)} width={600} height={400} sizes="(min-width: 1024px) 50vw, 100vw" className="rounded-2xl shadow-2xl w-full h-auto" />
                ) : (
                  <div className="bg-gradient-to-br from-primary-100 to-primary-200 rounded-2xl h-80 flex items-center justify-center">
                    <Users size={80} className="text-primary-400" />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      ) : null}

      {/* Blog */}
      {posts.length > 0 && (
        <section className="py-16 md:py-20 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8 gap-4">
              <h2 className="section-title !mb-0">Conteúdos para você decidir melhor</h2>
              <Link href="/blog" className="text-sm font-semibold text-accent-700 hover:underline whitespace-nowrap">Ver o blog →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {posts.map(p => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="card group">
                  <div className="relative h-44 bg-primary-100">
                    {p.cover_image && <Image src={p.cover_image} alt="" fill sizes="(min-width: 768px) 33vw, 100vw" className="object-cover" />}
                  </div>
                  <div className="p-5">
                    <h3 className="font-bold text-primary-900 group-hover:text-accent-700 leading-snug">{p.title}</h3>
                    {p.excerpt && <p className="text-sm text-gray-500 mt-2 line-clamp-2">{p.excerpt}</p>}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA Final */}
      <section className="py-16 md:py-20 bg-gradient-to-r from-accent-600 to-accent-500 text-white">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-black mb-4">Ainda com dúvida sobre qual curso escolher?</h2>
          <p className="text-lg md:text-xl text-orange-100 mb-8">
            Fale com um consultor. A gente ajuda você a escolher o curso certo para o seu objetivo.
          </p>
          <a
            href={whatsappLink(footer.whatsapp, 'Olá! Quero ajuda para escolher meu curso.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-white text-accent-700 hover:bg-orange-50 font-bold text-lg px-10 py-4 rounded-xl shadow-xl transition-all hover:-translate-y-1"
          >
            Falar no WhatsApp agora
          </a>
        </div>
      </section>

      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context="a página inicial" />
    </>
  )
}
