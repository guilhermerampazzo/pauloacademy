import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { MessageCircle, Search } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import JsonLd from '@/components/JsonLd'
import { getContent } from '@/lib/data'
import { whatsappLink } from '@/lib/site'

// v2: página "Como funciona" (jornada do aluno). Conteúdo editável em Admin > Conteúdo.
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Como funciona estudar EAD na Academy Pop',
  description: 'Da matrícula ao certificado: veja o passo a passo para estudar online na Academy Pop, formas de pagamento, acesso à plataforma e emissão do certificado.',
  alternates: { canonical: '/como-funciona' },
}

function youtubeEmbed(url?: string) {
  const m = String(url || '').match(/(?:youtu\.be\/|v=|embed\/)([\w-]{11})/)
  return m ? `https://www.youtube-nocookie.com/embed/${m[1]}` : null
}

export default async function ComoFuncionaPage() {
  const content = await getContent()
  const data = (content.como_funciona || {}) as { title?: string; intro?: string; steps?: { title: string; text: string }[]; video_url?: string; images?: string[] }
  const footer = (content.footer || {}) as Record<string, string>
  const steps = data.steps || []
  const video = youtubeEmbed(data.video_url)

  return (
    <>
      <SiteHeader />
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-14 md:py-20">
        <div className="max-w-4xl mx-auto px-4">
          <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: 'Como funciona', path: '/como-funciona' }]} />
          <h1 className="text-3xl md:text-5xl font-black mb-4">{data.title || 'Como funciona'}</h1>
          {data.intro && <p className="text-blue-100 text-lg md:text-xl">{data.intro}</p>}
        </div>
      </section>

      <section className="py-14 md:py-20 bg-white">
        <div className="max-w-4xl mx-auto px-4">
          <ol className="relative border-l-2 border-accent-200 ml-4 space-y-10">
            {steps.map((s, i) => (
              <li key={i} className="pl-8 relative">
                <span className="absolute -left-[21px] top-0 w-10 h-10 rounded-full bg-accent-500 text-white font-bold flex items-center justify-center ring-4 ring-white">{i + 1}</span>
                <h2 className="text-xl font-bold text-primary-900 mb-1">{s.title}</h2>
                <p className="text-gray-600 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>

          {video && (
            <div className="mt-14 aspect-video rounded-2xl overflow-hidden shadow-xl">
              <iframe src={video} title="Conheça a plataforma" className="w-full h-full" loading="lazy" allowFullScreen
                allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
            </div>
          )}

          {!!data.images?.length && (
            <div className="mt-14 grid grid-cols-1 sm:grid-cols-2 gap-4">
              {data.images.filter(Boolean).map((src, i) => (
                <div key={i} className="relative aspect-video rounded-xl overflow-hidden border border-gray-100">
                  <Image src={src} alt={`Plataforma de estudos – imagem ${i + 1}`} fill sizes="(min-width: 640px) 50vw, 100vw" className="object-cover" />
                </div>
              ))}
            </div>
          )}

          <div className="mt-14 flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/cursos" className="btn-primary justify-center"><Search size={18} /> Encontrar meu curso</Link>
            <a href={whatsappLink(footer.whatsapp, 'Olá! Li como funciona no site e tenho uma dúvida.')} target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-6 py-3 rounded-lg">
              <MessageCircle size={18} /> Tirar dúvidas
            </a>
          </div>
        </div>
      </section>

      {steps.length > 0 && (
        <JsonLd data={{
          '@context': 'https://schema.org', '@type': 'HowTo', name: data.title || 'Como funciona',
          step: steps.map((s, i) => ({ '@type': 'HowToStep', position: i + 1, name: s.title, text: s.text })),
        }} />
      )}
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context="a página Como funciona" />
    </>
  )
}
