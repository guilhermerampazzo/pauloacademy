import type { Metadata } from 'next'
import { Target, Eye, Heart } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'

export const metadata: Metadata = {
  title: 'Sobre nós',
  description: 'Conheça a Academy Pop: polo oficial de instituições certificadoras, com cursos EAD reconhecidos e atendimento humanizado desde 2019.',
  alternates: { canonical: '/sobre-nos' },
}

async function getContent() {
  const base = process.env.INTERNAL_API_URL || 'http://backend:3001'
  try {
    const res = await fetch(`${base}/content`, { next: { revalidate: 300 } })
    return res.ok ? res.json() : {}
  } catch { return {} }
}

export default async function SobreNosPage() {
  const content = await getContent()
  const data = (content.sobre_nos || {}) as Record<string, string | string[]>
  const footer = (content.footer || {}) as Record<string, string>
  const values = (data.values as string[]) || []

  return (
    <>
      <SiteHeader />

      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-20">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-4">
            {String(data.title || 'Sobre a Academy Pop')}
          </h1>
          <p className="text-blue-200 text-xl max-w-2xl mx-auto">
            Educação de qualidade acessível para todos
          </p>
        </div>
      </section>

      {(data.mission || data.vision) && (
        <section className="py-16 bg-white">
          <div className="max-w-5xl mx-auto px-4 grid grid-cols-1 md:grid-cols-2 gap-10">
            {data.mission && (
              <div className="flex gap-5">
                <div className="w-14 h-14 bg-primary-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Target size={28} className="text-primary-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-900 mb-3">Nossa Missão</h2>
                  <p className="text-gray-600 leading-relaxed">{String(data.mission)}</p>
                </div>
              </div>
            )}
            {data.vision && (
              <div className="flex gap-5">
                <div className="w-14 h-14 bg-accent-100 rounded-2xl flex items-center justify-center shrink-0">
                  <Eye size={28} className="text-accent-700" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-primary-900 mb-3">Nossa Visão</h2>
                  <p className="text-gray-600 leading-relaxed">{String(data.vision)}</p>
                </div>
              </div>
            )}
          </div>
        </section>
      )}

      {values.length > 0 && (
        <section className="py-16 bg-gray-50">
          <div className="max-w-4xl mx-auto px-4">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center">
                <Heart size={24} className="text-red-500" />
              </div>
              <h2 className="text-2xl font-bold text-primary-900">Nossos Valores</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {values.map((val, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex items-center gap-3">
                  <div className="w-3 h-3 bg-accent-500 rounded-full shrink-0" />
                  <span className="font-semibold text-gray-800">{val}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {data.history && (
        <section className="py-16 bg-white">
          <div className="max-w-4xl mx-auto px-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
              <div>
                <h2 className="text-2xl font-bold text-primary-900 mb-4">Nossa História</h2>
                <p className="text-gray-600 leading-relaxed whitespace-pre-line">{String(data.history)}</p>
              </div>
              {data.image && (
                <div className="relative h-72 rounded-2xl overflow-hidden shadow-lg">
                  <img src={String(data.image)} alt="Sobre nós" className="w-full h-full object-cover" />
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      <SiteFooter />
      <WhatsAppButton number={String(footer.whatsapp || '')} context="a página Sobre nós" />
    </>
  )
}
