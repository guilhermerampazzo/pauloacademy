import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { Building2, GraduationCap, MapPin, ArrowRight, Handshake, MessageCircle, BadgePercent } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import JsonLd from '@/components/JsonLd'
import { getContent, getPartners, defaultOgImage, type Partner } from '@/lib/data'
import { breadcrumbSchema } from '@/lib/schema'
import { whatsappLink } from '@/lib/site'

// v2.4: página de parceiros (link só no menu institucional: rodapé e menu do celular).
// Cadastro em Admin > Parceiros.
export const revalidate = 120

export async function generateMetadata(): Promise<Metadata> {
  const og = await defaultOgImage()
  const title = 'Parceiros: instituições de ensino, empresas e convênios'
  const description = 'Conheça as instituições de ensino que certificam os cursos da Academy Pop e as empresas e convênios com condições especiais para seus funcionários e associados.'
  return {
    title, description,
    alternates: { canonical: '/parceiros' },
    openGraph: { title, description, url: '/parceiros', type: 'website', images: [{ url: og, width: 1200, height: 630 }] },
  }
}

function PartnerCard({ p }: { p: Partner }) {
  return (
    <Link href={`/parceiros/${p.slug}`} className="card group flex flex-col p-6">
      <div className="flex items-center gap-4 mb-4">
        <div className="relative w-20 h-20 shrink-0 rounded-xl bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center">
          {p.logo ? <Image src={p.logo} alt={`Logo ${p.name}`} fill sizes="80px" className="object-contain p-2" />
            : (p.type === 'ies' ? <GraduationCap size={32} className="text-primary-300" /> : <Building2 size={32} className="text-primary-300" />)}
        </div>
        <div className="min-w-0">
          <h3 className="font-bold text-lg text-primary-900 group-hover:text-accent-700 leading-snug">{p.name}</h3>
          {p.city && <p className="text-xs text-gray-500 flex items-center gap-1 mt-1"><MapPin size={12} /> {p.city}{p.state ? `/${p.state}` : ''}</p>}
        </div>
      </div>
      {p.benefit && (
        <p className="text-sm font-semibold text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-3 flex items-center gap-2"><BadgePercent size={16} className="shrink-0" /> {p.benefit}</p>
      )}
      {p.summary && <p className="text-sm text-gray-600 line-clamp-3 flex-1">{p.summary}</p>}
      {p.type === 'ies' && p.emec_code && <p className="text-xs text-gray-400 mt-3">Código e-MEC {p.emec_code}</p>}
      <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-accent-700 group-hover:gap-2 transition-all">Conhecer <ArrowRight size={16} /></span>
    </Link>
  )
}

export default async function ParceirosPage() {
  const [partners, content] = await Promise.all([getPartners(), getContent()])
  const footer = (content.footer || {}) as Record<string, string>
  const ies = partners.filter(p => p.type === 'ies')
  const empresas = partners.filter(p => p.type === 'empresa')
  const crumbs = [{ name: 'Início', path: '/' }, { name: 'Parceiros', path: '/parceiros' }]
  const waEmpresa = whatsappLink(footer.whatsapp, 'Olá! Represento uma empresa/associação e quero saber como firmar um convênio com a Academy Pop.')

  return (
    <>
      <SiteHeader />
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={crumbs} />
          <h1 className="text-3xl md:text-5xl font-black mb-3">Nossos parceiros</h1>
          <p className="text-blue-100 text-lg max-w-3xl">
            As instituições de ensino que certificam os nossos cursos e as empresas e convênios que oferecem condições especiais aos seus funcionários e associados.
          </p>
        </div>
      </section>

      <section className="py-14 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-14">
          {partners.length === 0 && <p className="text-center text-gray-500 py-10">Em breve, a lista dos nossos parceiros.</p>}

          {ies.length > 0 && (
            <div id="instituicoes" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-2"><GraduationCap className="text-accent-600" /><h2 className="text-2xl md:text-3xl font-bold text-primary-900">Instituições de ensino</h2></div>
              <p className="text-gray-600 mb-6 max-w-3xl">Instituições credenciadas pelo MEC que emitem os certificados e diplomas. Na página de cada uma você encontra o código e-MEC para conferir.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{ies.map(p => <PartnerCard key={p.id} p={p} />)}</div>
            </div>
          )}

          {empresas.length > 0 && (
            <div id="convenios" className="scroll-mt-24">
              <div className="flex items-center gap-3 mb-2"><Building2 className="text-accent-600" /><h2 className="text-2xl md:text-3xl font-bold text-primary-900">Empresas e convênios</h2></div>
              <p className="text-gray-600 mb-6 max-w-3xl">Funcionários e associados destas organizações têm condições especiais para estudar na Academy Pop.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">{empresas.map(p => <PartnerCard key={p.id} p={p} />)}</div>
            </div>
          )}

          <div className="rounded-2xl bg-white border border-gray-100 p-8 md:flex items-center justify-between gap-8">
            <div className="flex gap-4">
              <Handshake size={40} className="text-accent-600 shrink-0" />
              <div>
                <h2 className="text-xl font-bold text-primary-900">Sua empresa ou associação quer ser parceira?</h2>
                <p className="text-gray-600 mt-1">Ofereça cursos EAD com condições especiais para a sua equipe ou seus associados.</p>
              </div>
            </div>
            <a href={waEmpresa} target="_blank" rel="noopener noreferrer"
              className="mt-5 md:mt-0 inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-lg shrink-0">
              <MessageCircle size={18} /> Falar sobre convênio
            </a>
          </div>
        </div>
      </section>

      <JsonLd data={breadcrumbSchema(crumbs)} />
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context="a página de parceiros" />
    </>
  )
}
