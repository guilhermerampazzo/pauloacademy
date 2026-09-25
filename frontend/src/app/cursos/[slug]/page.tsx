import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'
import {
  Clock, Monitor, Tag, Award, CheckCircle, ChevronDown,
  Users, MessageCircle
} from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import CountdownTimer from '@/components/public/CountdownTimer'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import AddToCartButton from '@/components/public/AddToCartButton'
import StickyBuyBar from '@/components/public/StickyBuyBar'
import Testimonials from '@/components/public/Testimonials'
import CourseCard from '@/components/public/CourseCard'
import TrackView from '@/components/public/TrackView'
import RecordRecent from '@/components/public/RecordRecent'
import JsonLd from '@/components/JsonLd'
import { getContent, getCourse, getTestimonials, getTmbPublic } from '@/lib/data'
import { honestText, installmentHasInterest, tmbSimulate } from '@/lib/pricing'
import TmbTable from '@/components/public/TmbTable'
import type { Course } from '@/types'
import { getCategoryInfo, categoryHref } from '@/lib/categories'
import { courseSchema, faqSchema } from '@/lib/schema'
import { brl, stripHtml, whatsappLink } from '@/lib/site'

export const revalidate = 60

// v2.4: tira "sem juros" dos textos quando o parcelado soma mais que o PIX
function sanitize<T extends Course>(c: T): T {
  return {
    ...c,
    subtitle: honestText(c.subtitle, c),
    description: honestText(c.description, c),
    seo_title: honestText(c.seo_title, c),
    seo_description: honestText(c.seo_description, c),
    extra_sections: (c.extra_sections || []).map(s => ({ ...s, title: honestText(s.title, c), content: honestText(s.content, c) })),
    faqs: (c.faqs || []).map(f => ({ ...f, question: honestText(f.question, c), answer: honestText(f.answer, c) })),
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const raw = await getCourse(params.slug)
  if (!raw) return { title: 'Curso não encontrado', robots: { index: false } }
  const course = sanitize(raw)
  const title = course.seo_title || course.title
  const description = course.seo_description || course.subtitle || stripHtml(course.description, 158)
  const path = `/cursos/${course.slug}`
  return {
    title: { absolute: `${title} | Academy Pop` },
    description,
    alternates: { canonical: path },
    openGraph: {
      type: 'website',
      url: path,
      title,
      description,
      images: course.cover_image ? [{ url: course.cover_image, alt: course.title }] : undefined,
    },
    twitter: { card: 'summary_large_image', title, description, images: course.cover_image ? [course.cover_image] : undefined },
  }
}

export default async function CoursePage({ params }: { params: { slug: string } }) {
  const [raw, content, tmb] = await Promise.all([getCourse(params.slug), getContent(), getTmbPublic()])
  if (!raw) notFound()
  const course = sanitize(raw)

  const footer = (content.footer || {}) as Record<string, string>
  const pricePix = Number(course.price_pix || 0)
  const priceOriginal = Number(course.price_original || 0)
  const discountPercent = Number(course.discount_percent || 0)
  const installmentValue = Number(course.installment_value || 0)
  const whatsappNumber = footer.whatsapp || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''
  const whatsappHref = whatsappLink(whatsappNumber, course.whatsapp_message || `Olá! Tenho interesse no curso ${course.title}.`)
  const cat = getCategoryInfo(course.category)
  const offerActive = !!course.offer_expires_at && new Date(course.offer_expires_at).getTime() > Date.now()
  // v2.4: parcelado sem cartão (TMB) disponível para esta categoria e preço
  const tmbCat = tmb.enabled ? tmb.categories?.[course.category] : undefined
  const tmbAvailable = !!tmbCat && pricePix >= (tmb.min_value || 144)
  const checkoutHref = `/checkout?curso=${course.id}`
  const tmbSim = tmbAvailable && tmbCat ? tmbSimulate(tmbCat, pricePix) : null
  // v2.4: "sem juros" só quando o total no cartão não passa do PIX
  const semJuros = installmentValue > 0 && !installmentHasInterest(course)
  const cartItem = { course_id: course.id, slug: course.slug, title: course.title, cover_image: course.cover_image, category: course.category, price_pix: pricePix }

  // Depoimentos: do curso; se não houver, da mesma categoria
  const courseTestimonials = course.testimonials || []
  const testimonials = courseTestimonials.length ? courseTestimonials : await getTestimonials({ category: course.category, limit: 3 })
  const faq = faqSchema(course.faqs || [])

  return (
    <>
      <SiteHeader />
      <TrackView event="view_item" params={{ currency: 'BRL', value: pricePix, items: [{ item_id: String(course.id), item_name: course.title, item_category: course.category, price: pricePix }] }} />
      <RecordRecent slug={course.slug} title={course.title} />

      {/* Hero do Curso */}
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-12 items-center">
            <div>
              <Breadcrumbs items={[
                { name: 'Início', path: '/' },
                { name: cat.label, path: categoryHref(course.category) },
                { name: course.title, path: `/cursos/${course.slug}` },
              ]} />
              <Link href={categoryHref(course.category)} className="badge bg-accent-500 text-white mb-4 inline-block">{cat.label}</Link>
              <h1 className="text-3xl md:text-5xl font-black leading-tight mb-4">{course.title}</h1>
              {course.subtitle && <p className="text-lg md:text-xl text-blue-200 mb-6">{course.subtitle}</p>}

              <div className="flex flex-wrap gap-3 mb-6 text-base font-semibold text-blue-100">
                {course.workload ? (
                  <span className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                    <Clock size={18} className="text-accent-400" /> {course.workload} horas
                  </span>
                ) : null}
                <span className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                  <Monitor size={18} className="text-accent-400" /> {course.modality}
                </span>
                {course.duration && (
                  <span className="flex items-center gap-2 bg-white/10 rounded-lg px-3 py-1.5">
                    <Tag size={18} className="text-accent-400" /> {course.duration}
                  </span>
                )}
                {/* v2: sem animação piscando; exibido só quando cadastrado no admin */}
                {course.vacancy_count ? (
                  <span className="flex items-center gap-2 bg-accent-500/30 border border-accent-400/50 text-accent-200 rounded-lg px-3 py-1.5 text-sm">
                    <Users size={16} /> {course.vacancy_count} vagas nesta turma
                  </span>
                ) : null}
              </div>

              {offerActive && (
                <div className="bg-accent-500/20 border-2 border-accent-400/50 rounded-xl px-5 py-4 mb-2 inline-block">
                  <CountdownTimer expiresAt={course.offer_expires_at!} />
                </div>
              )}
            </div>

            {/* Cartão de Preço */}
            <div id="cartao-preco" className="bg-white text-gray-900 rounded-2xl shadow-2xl p-6 md:p-8">
              {course.cover_image && (
                <div className="relative h-48 rounded-xl overflow-hidden mb-6">
                  <Image src={course.cover_image} alt={course.title} fill priority sizes="(min-width: 1024px) 560px, 100vw" className="object-cover" />
                </div>
              )}
              <div className="mb-6">
                <p className="text-sm text-gray-500 mb-1">Investimento</p>
                {pricePix > 0 ? (
                  <>
                    {priceOriginal > 0 && discountPercent > 0 && (
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-gray-400 line-through text-base">{brl(priceOriginal)}</span>
                        <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">{discountPercent}% OFF</span>
                      </div>
                    )}
                    <p className="text-xs text-green-600 font-medium mb-0.5">À vista no PIX</p>
                    <p className="text-4xl font-black text-primary-900">{brl(pricePix)}</p>
                    {installmentValue > 0 && (
                      <p className="text-gray-500 mt-1">
                        ou {course.installments}x de <strong className="text-primary-700">{brl(installmentValue)}</strong>{semJuros ? <strong className="text-green-700"> sem juros</strong> : null} no cartão
                      </p>
                    )}
                    {tmbSim && (
                      <div className="mt-4">
                        <TmbTable sim={tmbSim} />
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Aceita PIX · Cartão · Boleto{tmbAvailable ? ' · Parcelado sem cartão' : ''}</p>
                  </>
                ) : (
                  <p className="text-2xl font-bold text-primary-700">Consulte condições</p>
                )}
              </div>

              {pricePix > 0 && (
                <>
                  <Link href={checkoutHref} className="btn-primary w-full justify-center text-base py-4 mb-3">
                    Matricular agora
                  </Link>
                  <AddToCartButton item={cartItem} className="w-full py-3 mb-3" />
                </>
              )}
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors">
                <MessageCircle size={18} /> Tirar dúvidas no WhatsApp
              </a>

              <div className="mt-6 pt-6 border-t border-gray-100 space-y-2">
                {['Certificado com validade nacional', 'Acesso ao material assim que a matrícula é confirmada', 'Suporte dedicado', 'Estude no seu ritmo'].map(b => (
                  <div key={b} className="flex items-center gap-2 text-sm text-gray-600">
                    <CheckCircle size={16} className="text-green-500 shrink-0" /> {b}
                  </div>
                ))}
                <Link href="/reconhecimento-mec" className="block text-xs text-primary-700 hover:underline pt-1">Como verificar o reconhecimento no MEC →</Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sobre o Curso */}
      <section className="py-16 bg-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-primary-900 mb-8">Sobre o Curso</h2>
          {course.description && (
            <div
              className="prose-content text-gray-700 leading-relaxed"
              dangerouslySetInnerHTML={{ __html: course.description }}
            />
          )}
        </div>
      </section>

      {/* Seções Extras */}
      {course.extra_sections && course.extra_sections.length > 0 && course.extra_sections.map((sec, i) => (
        <section key={sec.id || i} className={`py-16 ${i % 2 === 0 ? 'bg-gray-50' : 'bg-white'}`}>
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-900 mb-8">{sec.title}</h2>
            <div className={`${sec.image ? 'grid grid-cols-1 md:grid-cols-2 gap-10 items-start' : ''}`}>
              {sec.content && (
                <div
                  className="prose-content text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: sec.content }}
                />
              )}
              {sec.image && (
                <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden shadow-lg">
                  <Image src={sec.image} alt={sec.title} fill sizes="(min-width: 768px) 448px, 100vw" className="object-cover" />
                </div>
              )}
            </div>
            {/* v2.4: botão de matrícula ao fim de cada seção adicional */}
            <div className="mt-8 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5">
              {pricePix > 0 ? (
                <>
                  <Link href={checkoutHref} className="btn-primary justify-center text-base px-8 py-3.5">Matricular agora</Link>
                  <p className="text-sm text-gray-600">
                    <strong className="text-primary-900">{brl(pricePix)}</strong> no PIX
                    {installmentValue > 0 ? ` ou ${course.installments}x de ${brl(installmentValue)}${semJuros ? ' sem juros' : ''} no cartão` : ''}
                    {tmbSim?.opcoes.length ? ` · ou boleto/PIX parcelado em até ${tmbSim.opcoes[tmbSim.opcoes.length - 1].parcelas}x` : ''}
                  </p>
                </>
              ) : (
                <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="btn-primary justify-center text-base px-8 py-3.5">
                  <MessageCircle size={18} /> Quero me matricular
                </a>
              )}
            </div>
          </div>
        </section>
      ))}

      {/* Grade Curricular */}
      {course.modules && course.modules.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-900 mb-8">Grade Curricular</h2>
            <div className="space-y-4">
              {course.modules.map((mod, i) => (
                <details key={mod.id || i} className="bg-white rounded-xl shadow-sm border border-gray-100 group" open={i === 0}>
                  <summary className="flex items-center justify-between p-5 cursor-pointer select-none">
                    <div className="flex items-center gap-3">
                      <span className="w-8 h-8 bg-primary-100 text-primary-700 rounded-lg flex items-center justify-center text-sm font-bold shrink-0">
                        {i + 1}
                      </span>
                      <span className="font-semibold text-primary-900">{mod.name}</span>
                      {mod.workload > 0 && (
                        <span className="text-xs text-gray-400 hidden sm:block">{mod.workload}h</span>
                      )}
                    </div>
                    <ChevronDown size={18} className="text-gray-400 group-open:rotate-180 transition-transform shrink-0" />
                  </summary>
                  {mod.disciplines && mod.disciplines.length > 0 && (
                    <div className="px-5 pb-5 border-t border-gray-100">
                      <ul className="mt-4 space-y-2">
                        {(mod.disciplines as Array<string | { name: string }>).map((d, j) => (
                          <li key={j} className="flex items-center gap-2 text-sm text-gray-600">
                            <div className="w-1.5 h-1.5 bg-accent-500 rounded-full shrink-0" />
                            {typeof d === 'string' ? d : d.name}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Corpo Docente */}
      {course.professors && course.professors.filter(p => (p.team_type || 'docente') === 'docente').length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-900 mb-8">Corpo Docente</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {course.professors.filter(p => (p.team_type || 'docente') === 'docente').map(prof => (
                <div key={prof.id} className="flex gap-4 p-5 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="relative w-16 h-16 shrink-0">
                    {prof.photo ? (
                      <Image src={prof.photo} alt={prof.name} fill sizes="64px" className="rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-primary-200 rounded-full flex items-center justify-center text-primary-600 font-bold text-xl">
                        {prof.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-primary-900 truncate">{prof.name}</h3>
                    {prof.role && prof.role !== 'Professor' && (
                      <span className="inline-block text-xs font-semibold text-accent-700 bg-accent-100 px-2 py-0.5 rounded-full mt-0.5 mb-1">{prof.role}</span>
                    )}
                    {prof.bio && <p className="text-gray-600 text-sm mt-1">{prof.bio.slice(0, 300)}{prof.bio.length > 300 ? '...' : ''}</p>}
                    {prof.specialties && prof.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {prof.specialties.map(s => (
                          <span key={s} className="badge bg-primary-100 text-primary-700">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Corpo Administrativo Comercial */}
      {course.professors && course.professors.filter(p => p.team_type === 'comercial').length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-900 mb-8">Corpo Administrativo Comercial</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {course.professors.filter(p => p.team_type === 'comercial').map(prof => (
                <div key={prof.id} className="flex gap-4 p-5 bg-white rounded-xl border border-gray-100">
                  <div className="relative w-16 h-16 shrink-0">
                    {prof.photo ? (
                      <Image src={prof.photo} alt={prof.name} fill sizes="64px" className="rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 bg-primary-200 rounded-full flex items-center justify-center text-primary-600 font-bold text-xl">
                        {prof.name.charAt(0)}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <h3 className="font-bold text-primary-900 truncate">{prof.name}</h3>
                    {prof.role && (
                      <span className="inline-block text-xs font-semibold text-accent-700 bg-accent-100 px-2 py-0.5 rounded-full mt-0.5 mb-1">{prof.role}</span>
                    )}
                    {prof.bio && <p className="text-gray-600 text-sm mt-1">{prof.bio.slice(0, 300)}{prof.bio.length > 300 ? '...' : ''}</p>}
                    {prof.specialties && prof.specialties.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {prof.specialties.map(s => (
                          <span key={s} className="badge bg-primary-100 text-primary-700">{s}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      
      <Testimonials items={testimonials} bg="bg-primary-50" />

      {/* FAQ do Curso */}
      {course.faqs && course.faqs.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold text-primary-900 mb-8">Perguntas Frequentes</h2>
            <div className="space-y-3">
              {course.faqs.map((faq, i) => (
                <details key={faq.id || i} className="bg-white rounded-xl shadow-sm border border-gray-100 group">
                  <summary className="flex items-center justify-between p-5 cursor-pointer select-none font-semibold text-primary-900">
                    {faq.question}
                    <ChevronDown size={18} className="text-gray-400 group-open:rotate-180 transition-transform shrink-0 ml-4" />
                  </summary>
                  <div className="px-5 pb-5 text-gray-600 leading-relaxed border-t border-gray-100 pt-4">
                    {faq.answer}
                  </div>
                </details>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Cursos relacionados – link interno */}
      {course.related && course.related.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8 gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-900">Outros cursos de {cat.label}</h2>
              <Link href={categoryHref(course.category)} className="text-sm font-semibold text-accent-700 hover:underline whitespace-nowrap">Ver todos →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {course.related.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      {/* CTA Final */}
      <section className="py-16 bg-gradient-to-r from-primary-900 to-primary-800 text-white">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <Award size={48} className="mx-auto mb-4 text-accent-400" />
          <h2 className="text-3xl font-black mb-4">Comece o seu {cat.label === 'EJA' ? 'EJA' : 'curso'} hoje</h2>
          <p className="text-blue-200 mb-8 text-lg">
            {pricePix > 0
              ? `${brl(pricePix)} à vista no PIX${installmentValue > 0 ? ` ou ${course.installments}x de ${brl(installmentValue)}` : ''}`
              : 'Entre em contato para saber as condições'}
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {pricePix > 0 && (
              <Link href={checkoutHref} className="btn-primary text-base px-10 py-4 justify-center">
                Matricular agora
              </Link>
            )}
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer"
               className="flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-10 py-4 rounded-lg transition-colors">
              <MessageCircle size={20} /> WhatsApp
            </a>
          </div>
        </div>
      </section>

      <JsonLd data={courseSchema(course)} />
      {faq && <JsonLd data={faq} />}

      <div className="pb-20 md:pb-0"><SiteFooter /></div>
      <WhatsAppButton number={whatsappNumber} message={course.whatsapp_message || `Olá! Estou vendo o curso ${course.title} no site e gostaria de mais informações.`} hideOnMobile />
      <StickyBuyBar item={cartItem} price={pricePix} installments={course.installments} installmentValue={installmentValue} whatsappHref={whatsappHref} />
    </>
  )
}
