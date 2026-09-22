'use client'
import { useRouter, useSearchParams } from 'next/navigation'
import { getCategoryInfo } from '@/lib/categories'

// Filtros do catálogo: tipo de curso (com contagem), preço máximo e ordenação.
export default function CatalogFilters({ facets, total, categoria, ordem, precoMax }:
  { facets: { category: string; count: number }[]; total: number; categoria: string; ordem: string; precoMax: string }) {
  const router = useRouter()
  const sp = useSearchParams()

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString())
    if (value) next.set(key, value); else next.delete(key)
    next.delete('pagina')
    router.push(`/cursos${next.toString() ? `?${next}` : ''}`, { scroll: false })
  }

  const sorted = [...facets].sort((a, b) => getCategoryInfo(a.category).order - getCategoryInfo(b.category).order)

  return (
    <div className="flex flex-col lg:flex-row lg:items-center gap-4 mb-6">
      <div className="flex gap-2 overflow-x-auto pb-1 flex-1 [scrollbar-width:thin]">
        <button onClick={() => set('categoria', '')}
          className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-full border ${!categoria ? 'bg-primary-900 text-white border-primary-900' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
          Todos ({total})
        </button>
        {sorted.map(f => (
          <button key={f.category} onClick={() => set('categoria', categoria === f.category ? '' : f.category)}
            className={`shrink-0 text-sm font-semibold px-4 py-2 rounded-full border ${categoria === f.category ? 'bg-primary-900 text-white border-primary-900' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'}`}>
            {getCategoryInfo(f.category).label} ({f.count})
          </button>
        ))}
      </div>
      <div className="flex gap-3">
        <select value={precoMax} onChange={e => set('preco_max', e.target.value)} className="input bg-white w-44" aria-label="Preço máximo">
          <option value="">Qualquer preço</option>
          <option value="500">Até R$ 500</option>
          <option value="1000">Até R$ 1.000</option>
          <option value="2000">Até R$ 2.000</option>
          <option value="5000">Até R$ 5.000</option>
        </select>
        <select value={ordem} onChange={e => set('ordem', e.target.value === 'relevance' ? '' : e.target.value)} className="input bg-white w-48" aria-label="Ordenar">
          <option value="relevance">Mais relevantes</option>
          <option value="price_asc">Menor preço</option>
          <option value="price_desc">Maior preço</option>
          <option value="workload_asc">Menor carga horária</option>
          <option value="workload_desc">Maior carga horária</option>
          <option value="recent">Mais recentes</option>
        </select>
      </div>
    </div>
  )
}
