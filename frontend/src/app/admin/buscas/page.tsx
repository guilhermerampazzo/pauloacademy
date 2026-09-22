'use client'
// v2: relatório da busca do site: o que os clientes procuram e o que NÃO encontram
import { useEffect, useState } from 'react'
import { Loader2, SearchX, TrendingUp } from 'lucide-react'
import api from '@/lib/api'

interface Report {
  days: number
  totals: { total: number; zero: number }
  top: { term: string; searches: number; avg_results: number }[]
  zero_results: { term: string; searches: number; last_at: string }[]
}

export default function BuscasPage() {
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Report | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    api.get(`/search/report?days=${days}`).then(r => setData(r.data)).finally(() => setLoading(false))
  }, [days])

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Buscas no site</h1>
          <p className="text-gray-500">Termos pesquisados pelos visitantes na busca de cursos.</p>
        </div>
        <select value={days} onChange={e => setDays(Number(e.target.value))} className="input w-40">
          <option value={7}>Últimos 7 dias</option>
          <option value={30}>Últimos 30 dias</option>
          <option value={90}>Últimos 90 dias</option>
        </select>
      </div>

      {loading || !data ? <div className="p-16 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div> : (
        <>
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div className="bg-white rounded-xl p-4 border border-gray-100"><p className="text-sm text-gray-500">Buscas</p><p className="text-2xl font-bold">{data.totals.total}</p></div>
            <div className="bg-white rounded-xl p-4 border border-gray-100"><p className="text-sm text-gray-500">Sem resultado</p><p className="text-2xl font-bold text-red-600">{data.totals.zero}</p></div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <h2 className="font-bold p-4 border-b border-gray-100 flex items-center gap-2"><SearchX size={18} className="text-red-500" /> Procuraram e não encontraram</h2>
              <p className="text-xs text-gray-500 px-4 pt-3">Oportunidades: cursos a cadastrar ou sinônimos a incluir no título/descrição.</p>
              <table className="w-full text-sm mt-2">
                <tbody className="divide-y divide-gray-50">
                  {data.zero_results.length === 0 && <tr><td className="p-4 text-gray-400">Nada por aqui.</td></tr>}
                  {data.zero_results.map(r => (
                    <tr key={r.term}><td className="px-4 py-2.5">{r.term}</td><td className="px-4 py-2.5 text-right text-gray-500">{r.searches}x</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              <h2 className="font-bold p-4 border-b border-gray-100 flex items-center gap-2"><TrendingUp size={18} className="text-green-600" /> Mais buscados</h2>
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500 uppercase"><tr><th className="text-left px-4 py-2">Termo</th><th className="text-right px-4 py-2">Buscas</th><th className="text-right px-4 py-2">Resultados</th></tr></thead>
                <tbody className="divide-y divide-gray-50">
                  {data.top.length === 0 && <tr><td className="p-4 text-gray-400" colSpan={3}>Ainda sem buscas registradas.</td></tr>}
                  {data.top.map(r => (
                    <tr key={r.term}><td className="px-4 py-2.5">{r.term}</td><td className="px-4 py-2.5 text-right">{r.searches}</td><td className="px-4 py-2.5 text-right text-gray-500">{r.avg_results}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
