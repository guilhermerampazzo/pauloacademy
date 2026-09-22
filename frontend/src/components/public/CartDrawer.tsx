'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, Trash2, ShoppingCart, Loader2, ArrowRight, AlertCircle } from 'lucide-react'
import { useCart, fetchQuote, type Quote } from '@/lib/cart'
import { brl } from '@/lib/site'

// Painel lateral do carrinho. Preços vêm do servidor (cotação), não do navegador.
export default function CartDrawer() {
  const { items, open, setOpen, remove } = useCart()
  const [quote, setQuote] = useState<Quote | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!open) return
    if (!items.length) { setQuote(null); return }
    setLoading(true)
    fetchQuote(items.map(i => i.course_id)).then(setQuote).catch(() => setQuote(null)).finally(() => setLoading(false))
  }, [open, items])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [open, setOpen])

  if (!open) return null
  const unavailable = new Set(quote?.unavailable.map(u => u.course_id) || [])
  const priceOf = (id: number) => quote?.items.find(i => i.course_id === id)

  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Carrinho">
      <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
      <aside className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-2xl flex flex-col animate-slide-up md:animate-none">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-bold text-lg text-primary-900 flex items-center gap-2"><ShoppingCart size={20} /> Seu carrinho</h2>
          <button onClick={() => setOpen(false)} className="p-2 text-gray-400 hover:text-gray-700" aria-label="Fechar carrinho"><X size={20} /></button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-8 text-gray-500">
            <ShoppingCart size={48} className="mb-4 opacity-30" />
            <p className="font-medium text-gray-700">Seu carrinho está vazio</p>
            <p className="text-sm mt-1 mb-6">Adicione um ou mais cursos e pague tudo de uma vez.</p>
            <Link href="/cursos" onClick={() => setOpen(false)} className="btn-primary text-sm">Ver cursos</Link>
          </div>
        ) : (
          <>
            <ul className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {items.map(it => {
                const p = priceOf(it.course_id)
                const off = unavailable.has(it.course_id)
                return (
                  <li key={it.course_id} className="flex gap-3 px-5 py-4">
                    <div className="w-20 h-14 rounded-lg bg-gradient-to-br from-primary-800 to-primary-900 overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      {it.cover_image && <img src={it.cover_image} alt="" className="w-full h-full object-cover" />}
                    </div>
                    <div className="min-w-0 flex-1">
                      <Link href={`/cursos/${it.slug}`} onClick={() => setOpen(false)} className="text-sm font-semibold text-gray-800 hover:text-accent-700 line-clamp-2">{it.title}</Link>
                      {off ? (
                        <p className="text-xs text-red-600 mt-1 flex items-center gap-1"><AlertCircle size={12} /> Indisponível para compra online</p>
                      ) : (
                        <p className="text-sm text-primary-900 font-bold mt-1">{p ? brl(p.final_price) : loading ? '…' : ''}</p>
                      )}
                    </div>
                    <button onClick={() => remove(it.course_id)} className="p-1.5 self-start text-gray-400 hover:text-red-500" aria-label={`Remover ${it.title}`}>
                      <Trash2 size={16} />
                    </button>
                  </li>
                )
              })}
            </ul>
            <div className="border-t border-gray-100 px-5 py-4 space-y-3 bg-gray-50">
              <div className="flex justify-between items-baseline">
                <span className="text-gray-600 text-sm">Total no PIX</span>
                <span className="text-2xl font-black text-primary-900">
                  {loading ? <Loader2 size={20} className="animate-spin inline" /> : brl(quote?.total || 0)}
                </span>
              </div>
              <p className="text-xs text-gray-500 -mt-2 text-right">Cupom de desconto e parcelamento no próximo passo</p>
              <Link href="/checkout" onClick={() => setOpen(false)}
                className={`btn-primary w-full justify-center py-3.5 ${!quote?.items.length ? 'pointer-events-none opacity-50' : ''}`}>
                Finalizar matrícula <ArrowRight size={18} />
              </Link>
              <div className="flex justify-between text-sm">
                <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-gray-800">Continuar escolhendo</button>
                <Link href="/carrinho" onClick={() => setOpen(false)} className="text-accent-700 font-semibold hover:underline">Ver carrinho</Link>
              </div>
            </div>
          </>
        )}
      </aside>
    </div>
  )
}
