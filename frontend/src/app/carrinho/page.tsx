'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ShoppingCart, Trash2, ArrowRight, Loader2, AlertCircle, ArrowLeft } from 'lucide-react'
import { useCart, fetchQuote, type Quote } from '@/lib/cart'
import { brl } from '@/lib/site'

// Página do carrinho (v2). Preços calculados no servidor.
export default function CarrinhoPage() {
  const { items, ready, remove } = useCart()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!ready) return
    if (!items.length) { setQuote(null); setLoading(false); return }
    setLoading(true)
    fetchQuote(items.map(i => i.course_id)).then(setQuote).catch(() => setQuote(null)).finally(() => setLoading(false))
  }, [items, ready])

  const unavailable = new Set(quote?.unavailable.map(u => u.course_id) || [])

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary-900 text-white py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href="/" className="text-blue-300 hover:text-white" aria-label="Voltar"><ArrowLeft size={20} /></Link>
          <span className="font-semibold flex items-center gap-2"><ShoppingCart size={18} /> Carrinho</span>
        </div>
      </div>
      <div className="max-w-5xl mx-auto px-4 py-10">
        {!ready || (loading && !quote) ? (
          <div className="flex justify-center py-20"><Loader2 size={36} className="animate-spin text-primary-500" /></div>
        ) : !items.length ? (
          <div className="bg-white rounded-2xl p-12 text-center border border-gray-100">
            <ShoppingCart size={48} className="mx-auto mb-4 text-gray-300" />
            <h1 className="text-xl font-bold text-gray-900">Seu carrinho está vazio</h1>
            <p className="text-gray-500 mt-2 mb-6">Adicione um ou mais cursos e pague tudo de uma vez.</p>
            <Link href="/cursos" className="btn-primary">Ver cursos</Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 divide-y divide-gray-100">
              <h1 className="text-xl font-bold text-primary-900 p-6">Cursos no carrinho ({items.length})</h1>
              {items.map(it => {
                const p = quote?.items.find(i => i.course_id === it.course_id)
                return (
                  <div key={it.course_id} className="flex gap-4 p-6">
                    <div className="w-28 h-20 rounded-lg bg-gradient-to-br from-primary-800 to-primary-900 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.cover_image && <img src={it.cover_image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <Link href={`/cursos/${it.slug}`} className="font-semibold text-gray-800 hover:text-accent-700">{it.title}</Link>
                      {p && <p className="text-xs text-gray-500 mt-1">{[p.modality, p.workload ? `${p.workload}h` : null, p.duration].filter(Boolean).join(' · ')}</p>}
                      {unavailable.has(it.course_id) && <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={12} /> Indisponível para compra online</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-primary-900">{p ? brl(p.final_price) : '—'}</p>
                      <button onClick={() => remove(it.course_id)} className="mt-2 text-xs text-gray-400 hover:text-red-500 inline-flex items-center gap-1"><Trash2 size={12} /> Remover</button>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="bg-white rounded-2xl border border-gray-100 p-6 h-fit lg:sticky lg:top-4">
              <div className="flex justify-between text-sm mb-2"><span className="text-gray-600">Subtotal</span><span>{brl(quote?.subtotal)}</span></div>
              <div className="flex justify-between font-bold text-lg pt-3 border-t border-gray-100">
                <span>Total no PIX</span><span className="text-primary-900">{brl(quote?.total)}</span>
              </div>
              <p className="text-xs text-gray-500 mt-2">Cupom e forma de pagamento no próximo passo.</p>
              <Link href="/checkout" className={`btn-primary w-full justify-center py-3.5 mt-5 ${!quote?.items.length ? 'pointer-events-none opacity-50' : ''}`}>
                Finalizar matrícula <ArrowRight size={18} />
              </Link>
              <Link href="/cursos" className="block text-center text-sm text-gray-500 hover:text-gray-800 mt-4">Continuar escolhendo</Link>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
