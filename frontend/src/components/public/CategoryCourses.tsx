'use client'
import { useMemo, useState } from 'react'
import { Search } from 'lucide-react'
import type { Course } from '@/types'
import CourseCard from './CourseCard'

const PAGE = 24
const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

// Lista da página de categoria com filtro rápido por nome, ordenação e "carregar mais"
export default function CategoryCourses({ courses }: { courses: Course[] }) {
  const [q, setQ] = useState('')
  const [sort, setSort] = useState('relevance')
  const [shown, setShown] = useState(PAGE)

  const list = useMemo(() => {
    const t = strip(q.trim())
    let l = t ? courses.filter(c => strip(`${c.title} ${c.subtitle || ''}`).includes(t)) : courses
    if (sort === 'price_asc') l = [...l].sort((a, b) => (Number(a.price_pix) || Infinity) - (Number(b.price_pix) || Infinity))
    if (sort === 'price_desc') l = [...l].sort((a, b) => Number(b.price_pix) - Number(a.price_pix))
    if (sort === 'workload') l = [...l].sort((a, b) => (a.workload || 0) - (b.workload || 0))
    if (sort === 'az') l = [...l].sort((a, b) => a.title.localeCompare(b.title, 'pt-BR'))
    return l
  }, [courses, q, sort])

  return (
    <>
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q} onChange={e => { setQ(e.target.value); setShown(PAGE) }} className="input pl-9 bg-white"
            placeholder="Filtrar por nome do curso..." aria-label="Filtrar cursos por nome" />
        </div>
        <select value={sort} onChange={e => setSort(e.target.value)} className="input sm:w-56 bg-white" aria-label="Ordenar cursos">
          <option value="relevance">Destaques primeiro</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="workload">Menor carga horária</option>
          <option value="az">Nome (A–Z)</option>
        </select>
      </div>
      <p className="text-sm text-gray-500 mb-4">{list.length} curso(s)</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {list.slice(0, shown).map((c, i) => <CourseCard key={c.id} course={c} priority={i < 3} />)}
      </div>
      {shown < list.length && (
        <div className="text-center mt-10">
          <button onClick={() => setShown(s => s + PAGE)} className="btn-secondary">
            Carregar mais ({list.length - shown} restantes)
          </button>
        </div>
      )}
      {list.length === 0 && <p className="text-center text-gray-500 py-10">Nenhum curso com esse nome nesta categoria.</p>}
    </>
  )
}
