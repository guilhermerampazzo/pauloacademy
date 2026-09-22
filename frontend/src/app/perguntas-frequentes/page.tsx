import type { Metadata } from 'next'
import { ChevronDown } from 'lucide-react'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import JsonLd from '@/components/JsonLd'
import { faqSchema } from '@/lib/schema'

export const metadata: Metadata = {
  title: 'Perguntas frequentes',
  description: 'Respostas sobre matrícula, pagamento, certificado e reconhecimento dos cursos EAD da Academy Pop.',
  alternates: { canonical: '/perguntas-frequentes' },
}

async function getContent() {
  const base = process.env.INTERNAL_API_URL || 'http://backend:3001'
  try {
    const res = await fetch(`${base}/content`, { next: { revalidate: 300 } })
    return res.ok ? res.json() : {}
  } catch { return {} }
}

export default async function FaqPage() {
  const content = await getContent()
  const footer = (content.footer as Record<string, unknown>) || {}
  const faqGeral = (content.faq_geral as Record<string, unknown>) || {}
  const items = (faqGeral.items as Array<{ question: string; answer: string }>) || []

  return (
    <>
      <SiteHeader />

      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-20">
        <div className="max-w-3xl mx-auto px-4 text-center">
          <h1 className="text-4xl md:text-5xl font-black mb-4">Perguntas Frequentes</h1>
          <p className="text-blue-200 text-xl">Tire suas dúvidas sobre nossos cursos e plataforma</p>
        </div>
      </section>

      <section className="py-16 bg-white">
        <div className="max-w-3xl mx-auto px-4">
          {items.length === 0 ? (
            <p className="text-center text-gray-400 py-16">
              Em breve. Enquanto isso, tire suas dúvidas pelo WhatsApp.
            </p>
          ) : (
            <div className="space-y-3">
              {items.map((item, i) => (
                <details key={i} className="bg-gray-50 rounded-xl border border-gray-100 group">
                  <summary className="flex items-center justify-between p-5 cursor-pointer select-none font-semibold text-primary-900 text-lg">
                    {item.question}
                    <ChevronDown size={20} className="text-gray-400 group-open:rotate-180 transition-transform shrink-0 ml-4" />
                  </summary>
                  <div className="px-5 pb-5 text-gray-600 leading-relaxed border-t border-gray-200 pt-4">
                    {item.answer}
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>
      </section>

      {faqSchema(items) && <JsonLd data={faqSchema(items)!} />}
      <SiteFooter />
      <WhatsAppButton number={String(footer.whatsapp || '')} context="as perguntas frequentes" />
    </>
  )
}
