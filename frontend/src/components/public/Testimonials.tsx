import Link from 'next/link'
import Image from 'next/image'
import { Star, Quote } from 'lucide-react'
import type { PublicTestimonial } from '@/lib/data'

// Prova social. Só aparece quando há depoimentos cadastrados (Admin > Depoimentos).
export default function Testimonials({ items, title = 'O que nossos alunos dizem', subtitle, bg = 'bg-primary-50' }:
  { items: PublicTestimonial[]; title?: string; subtitle?: string; bg?: string }) {
  if (!items.length) return null
  return (
    <section className={`py-16 md:py-20 ${bg}`}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10">
          <h2 className="section-title">{title}</h2>
          {subtitle && <p className="section-subtitle !mb-0">{subtitle}</p>}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {items.map(t => (
            <figure key={t.id} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
              <Quote size={28} className="text-accent-200 mb-2" aria-hidden />
              <div className="flex gap-0.5 mb-3" aria-label="5 de 5 estrelas">
                {[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-yellow-400 text-yellow-400" />)}
              </div>
              <blockquote className="text-gray-700 text-sm leading-relaxed mb-5 flex-1">&ldquo;{t.content}&rdquo;</blockquote>
              <figcaption className="flex items-center gap-3">
                <div className="relative w-11 h-11 shrink-0">
                  {t.photo ? (
                    <Image src={t.photo} alt={t.name} fill sizes="44px" className="rounded-full object-cover" />
                  ) : (
                    <div className="w-11 h-11 bg-primary-200 rounded-full flex items-center justify-center text-primary-700 font-bold">{t.name.charAt(0)}</div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-sm text-gray-900">{t.name}</p>
                  {t.role && <p className="text-xs text-gray-500">{t.role}</p>}
                  {t.course_title && t.course_slug && (
                    <Link href={`/cursos/${t.course_slug}`} className="text-xs text-accent-700 hover:underline line-clamp-1">{t.course_title}</Link>
                  )}
                </div>
              </figcaption>
            </figure>
          ))}
        </div>
      </div>
    </section>
  )
}
