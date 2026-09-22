import type { Metadata } from 'next'
import Image from 'next/image'
import { ExternalLink, ShieldCheck, CheckCircle } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import { getContent } from '@/lib/data'

// v2: página de reconhecimento (autoridade de marca). Conteúdo editável em Admin > Conteúdo.
// As instituições certificadoras e links do e-MEC precisam ser cadastrados pelo cliente.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Reconhecimento MEC e instituições certificadoras',
  description: 'Saiba quais instituições certificam os cursos da Academy Pop e como consultar o credenciamento no e-MEC.',
  alternates: { canonical: '/reconhecimento-mec' },
}

interface Institution { name: string; categories?: string; emec_url?: string; logo?: string; description?: string }

export default async function ReconhecimentoPage() {
  const content = await getContent()
  const data = (content.reconhecimento || {}) as { title?: string; intro?: string; institutions?: Institution[]; how_to_verify?: string[]; diploma_image?: string }
  const footer = (content.footer || {}) as Record<string, string>
  const institutions = (data.institutions || []).filter(i => i.name)

  return (
    <>
      <SiteHeader />
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-14 md:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: 'Reconhecimento MEC', path: '/reconhecimento-mec' }]} />
          <h1 className="text-3xl md:text-5xl font-black mb-4">{data.title || 'Reconhecimento MEC'}</h1>
          {data.intro && <p className="text-blue-100 text-lg md:text-xl">{data.intro}</p>}
        </div>
      </section>

      <section className="py-14 bg-white">
        <div className="max-w-5xl mx-auto px-4">
          {institutions.length > 0 && (
            <>
              <h2 className="text-2xl font-bold text-primary-900 mb-6">Instituições certificadoras</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-14">
                {institutions.map(inst => (
                  <div key={inst.name} className="p-6 rounded-2xl border border-gray-100 bg-gray-50 flex gap-4">
                    {inst.logo ? (
                      <div className="relative w-16 h-16 shrink-0 bg-white rounded-lg overflow-hidden">
                        <Image src={inst.logo} alt={inst.name} fill sizes="64px" className="object-contain p-1" />
                      </div>
                    ) : <ShieldCheck size={40} className="text-accent-500 shrink-0" />}
                    <div>
                      <p className="font-bold text-primary-900">{inst.name}</p>
                      {inst.categories && <p className="text-sm text-gray-600 mt-1">Certifica: {inst.categories}</p>}
                      {inst.description && <p className="text-sm text-gray-600 mt-1">{inst.description}</p>}
                      {inst.emec_url && (
                        <a href={inst.emec_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm font-semibold text-accent-700 hover:underline mt-2">
                          Ver no e-MEC <ExternalLink size={14} />
                        </a>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {!!data.how_to_verify?.length && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-10 items-start">
              <div>
                <h2 className="text-2xl font-bold text-primary-900 mb-5">Como verificar no e-MEC</h2>
                <ol className="space-y-3">
                  {data.how_to_verify.map((s, i) => (
                    <li key={i} className="flex gap-3 text-gray-700"><CheckCircle size={20} className="text-green-500 shrink-0 mt-0.5" /> {s}</li>
                  ))}
                </ol>
                <a href="https://emec.mec.gov.br" target="_blank" rel="noopener noreferrer" className="btn-secondary mt-6">
                  Abrir o e-MEC <ExternalLink size={16} />
                </a>
              </div>
              {data.diploma_image && (
                <div className="relative aspect-[4/3] rounded-2xl overflow-hidden border border-gray-100 shadow">
                  <Image src={data.diploma_image} alt="Modelo de certificado" fill sizes="(min-width: 768px) 50vw, 100vw" className="object-contain bg-gray-50" />
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context="a página de reconhecimento MEC" />
    </>
  )
}
