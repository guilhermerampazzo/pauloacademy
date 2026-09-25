import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Building2, GraduationCap, MapPin, ExternalLink, ShieldCheck, BadgePercent, MessageCircle, Users, ArrowRight } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import CourseCard from '@/components/public/CourseCard'
import JsonLd from '@/components/JsonLd'
import { getContent, getPartner, defaultOgImage, PARTNER_TYPE_LABEL } from '@/lib/data'
import { breadcrumbSchema, partnerSchema } from '@/lib/schema'
import { categoryHref, menuLabel } from '@/lib/categories'
import { stripHtml, whatsappLink } from '@/lib/site'

// v2.4: página de um parceiro (instituição de ensino ou empresa/convênio)
export const revalidate = 120

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const p = await getPartner(params.slug)
  if (!p) return { title: 'Parceiro não encontrado', robots: { index: false } }
  const title = p.seo_title || `${p.name} – ${p.type === 'ies' ? 'instituição parceira' : 'convênio'}`
  const description = p.seo_description || p.summary || stripHtml(p.content, 158)
  const image = p.cover_image || p.logo || await defaultOgImage()
  return {
    title, description,
    alternates: { canonical: `/parceiros/${p.slug}` },
    openGraph: { title, description, url: `/parceiros/${p.slug}`, type: 'website', images: [{ url: image }] },
  }
}

export default async function PartnerPage({ params }: { params: { slug: string } }) {
  const [p, content] = await Promise.all([getPartner(params.slug), getContent()])
  if (!p) notFound()
  const footer = (content.footer || {}) as Record<string, string>
  const isIes = p.type === 'ies'
  const crumbs = [{ name: 'Início', path: '/' }, { name: 'Parceiros', path: '/parceiros' }, { name: p.name, path: `/parceiros/${p.slug}` }]
  const wa = whatsappLink(footer.whatsapp, p.whatsapp_message || (isIes
    ? `Olá! Vi a página da ${p.name} no site e quero saber quais cursos ela certifica.`
    : `Olá! Sou da ${p.name} e quero usar a condição do convênio.`))
  const courses = p.related_courses || []

  return (
    <>
      <SiteHeader />
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={crumbs} />
          <div className="flex flex-col md:flex-row md:items-center gap-6">
            <div className="relative w-28 h-28 shrink-0 rounded-2xl bg-white overflow-hidden flex items-center justify-center shadow-lg">
              {p.logo ? <Image src={p.logo} alt={`Logo ${p.name}`} fill priority sizes="112px" className="object-contain p-3" />
                : (isIes ? <GraduationCap size={44} className="text-primary-300" /> : <Building2 size={44} className="text-primary-300" />)}
            </div>
            <div>
              <span className="badge bg-accent-500 text-white mb-3">{PARTNER_TYPE_LABEL[p.type]}</span>
              <h1 className="text-3xl md:text-5xl font-black leading-tight">{p.name}</h1>
              {p.city && <p className="text-blue-200 mt-2 flex items-center gap-1"><MapPin size={16} /> {p.city}{p.state ? `/${p.state}` : ''}</p>}
              {p.summary && <p className="text-lg text-blue-100 mt-4 max-w-3xl">{p.summary}</p>}
            </div>
          </div>
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-3 gap-10">
          <div className="lg:col-span-2">
            {p.cover_image && (
              <div className="relative h-64 md:h-80 rounded-2xl overflow-hidden mb-8">
                <Image src={p.cover_image} alt={p.name} fill sizes="(min-width: 1024px) 700px, 100vw" className="object-cover" />
              </div>
            )}
            {p.content ? <div className="prose-content" dangerouslySetInnerHTML={{ __html: p.content }} />
              : <p className="text-gray-600">{p.summary}</p>}
          </div>

          <aside className="space-y-5">
            {isIes && (p.emec_code || p.accreditation || p.mec_score || p.emec_url) && (
              <div className="rounded-2xl border border-gray-100 bg-gray-50 p-6">
                <p className="font-bold text-primary-900 flex items-center gap-2 mb-3"><ShieldCheck size={18} className="text-green-600" /> Credenciamento no MEC</p>
                <dl className="text-sm space-y-2">
                  {p.emec_code && <div><dt className="text-gray-500">Código e-MEC</dt><dd className="font-semibold text-gray-900">{p.emec_code}</dd></div>}
                  {p.mec_score && <div><dt className="text-gray-500">Conceito (CI/IGC)</dt><dd className="font-semibold text-gray-900">{p.mec_score}</dd></div>}
                  {p.accreditation && <div><dt className="text-gray-500">Atos de credenciamento</dt><dd className="text-gray-800 whitespace-pre-line">{p.accreditation}</dd></div>}
                </dl>
                {p.emec_url && (
                  <a href={p.emec_url} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary-700 hover:underline">
                    Conferir no e-MEC <ExternalLink size={14} />
                  </a>
                )}
                <Link href="/reconhecimento-mec" className="block text-xs text-gray-500 hover:underline mt-3">Como verificar o reconhecimento no MEC →</Link>
              </div>
            )}

            {!isIes && (p.benefit || p.coupon || p.eligibility) && (
              <div className="rounded-2xl border border-green-200 bg-green-50 p-6">
                <p className="font-bold text-green-800 flex items-center gap-2 mb-2"><BadgePercent size={18} /> Condição do convênio</p>
                {p.benefit && <p className="text-lg font-bold text-gray-900">{p.benefit}</p>}
                {p.coupon && (
                  <p className="text-sm text-gray-700 mt-3">Use o cupom <strong className="font-mono bg-white border border-green-300 rounded px-2 py-0.5">{p.coupon.code}</strong> no checkout ({p.coupon.discount_percent}% de desconto).</p>
                )}
                {p.eligibility && (
                  <p className="text-sm text-gray-700 mt-3 flex gap-2 whitespace-pre-line"><Users size={16} className="shrink-0 mt-0.5 text-green-700" /> {p.eligibility}</p>
                )}
              </div>
            )}

            <div className="rounded-2xl border border-gray-100 p-6 space-y-3">
              <a href={wa} target="_blank" rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                <MessageCircle size={18} /> {isIes ? 'Falar com um consultor' : 'Quero usar o convênio'}
              </a>
              {p.related_category && (
                <Link href={categoryHref(p.related_category)} className="btn-secondary w-full justify-center !py-2.5">Ver cursos de {menuLabel(p.related_category)}</Link>
              )}
              {p.website && (
                <a href={p.website} target="_blank" rel="noopener noreferrer nofollow" className="flex items-center justify-center gap-1 text-sm text-primary-700 hover:underline">
                  Site oficial <ExternalLink size={14} />
                </a>
              )}
            </div>
          </aside>
        </div>
      </section>

      {courses.length > 0 && (
        <section className="py-14 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8 gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-900">{isIes ? `Cursos de ${menuLabel(p.related_category!)}` : 'Cursos para você'}</h2>
              <Link href={categoryHref(p.related_category!)} className="text-sm font-semibold text-accent-700 hover:underline whitespace-nowrap inline-flex items-center gap-1">Ver todos <ArrowRight size={14} /></Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      <JsonLd data={[breadcrumbSchema(crumbs), partnerSchema(p)]} />
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context={`a página da ${p.name}`} />
    </>
  )
}
