import Link from 'next/link'
import Image from 'next/image'
import { Clock, Monitor, Tag, ArrowRight } from 'lucide-react'
import type { Course } from '@/types'
import { getCategoryInfo } from '@/lib/categories'
import { brl } from '@/lib/site'
import AddToCartButton from './AddToCartButton'

// Card de curso.
// v2: imagem com "sizes" (antes o navegador baixava a capa na largura da tela
// inteira), botão de carrinho, rótulo de categoria curto e sem <button> dentro de <a>.
export default function CourseCard({ course, priority = false }: { course: Course; priority?: boolean }) {
  const installmentValue = Number(course.installment_value || 0)
  const pricePix = Number(course.price_pix || 0)
  const href = `/cursos/${course.slug}`

  return (
    <article className="card group flex flex-col">
      <Link href={href} className="relative h-48 bg-gradient-to-br from-primary-800 to-primary-900 overflow-hidden block" tabIndex={-1} aria-hidden>
        {course.cover_image ? (
          <Image
            src={course.cover_image}
            alt=""
            fill
            sizes="(min-width: 1280px) 400px, (min-width: 768px) 50vw, 100vw"
            priority={priority}
            className="object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center opacity-20">
            <div className="w-24 h-24 border-4 border-white rounded-full" />
          </div>
        )}
        <div className="absolute top-3 left-3">
          <span className="badge bg-accent-500 text-white">{getCategoryInfo(course.category).label}</span>
        </div>
        {course.featured && (
          <div className="absolute top-3 right-3">
            <span className="badge bg-yellow-400 text-yellow-900">Destaque</span>
          </div>
        )}
      </Link>

      <div className="p-6 flex flex-col flex-1">
        <h3 className="font-bold text-primary-900 text-lg leading-tight mb-2 group-hover:text-accent-600 transition-colors">
          <Link href={href}>{course.title}</Link>
        </h3>
        {course.subtitle && (
          <p className="text-gray-500 text-sm mb-4 line-clamp-2">{course.subtitle}</p>
        )}

        <div className="flex flex-wrap gap-3 mb-4 text-xs text-gray-500">
          {course.workload ? (
            <span className="flex items-center gap-1"><Clock size={13} className="text-primary-600" />{course.workload}h</span>
          ) : null}
          <span className="flex items-center gap-1"><Monitor size={13} className="text-primary-600" />{course.modality}</span>
          {course.duration && (
            <span className="flex items-center gap-1"><Tag size={13} className="text-primary-600" />{course.duration}</span>
          )}
        </div>

        <div className="mt-auto pt-4 border-t border-gray-100">
          <div className="mb-4 min-h-[3.5rem]">
            {pricePix > 0 ? (
              <>
                <p className="text-xs text-gray-400">À vista no PIX</p>
                <p className="text-2xl font-bold text-primary-900">{brl(pricePix)}</p>
                {installmentValue > 0 && (
                  <p className="text-xs text-gray-500">ou {course.installments}x de {brl(installmentValue)}</p>
                )}
              </>
            ) : (
              <p className="text-sm font-semibold text-primary-700 pt-4">Consulte condições</p>
            )}
          </div>
          <div className="flex gap-2">
            <Link href={href} className="btn-primary flex-1 justify-center text-sm py-2.5">
              Ver detalhes <ArrowRight size={16} />
            </Link>
            {pricePix > 0 && (
              <AddToCartButton compact className="px-3"
                item={{ course_id: course.id, slug: course.slug, title: course.title, cover_image: course.cover_image, category: course.category, price_pix: pricePix }} />
            )}
          </div>
        </div>
      </div>
    </article>
  )
}
