'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { MessageCircle } from 'lucide-react'
import { brl } from '@/lib/site'
import { track } from '@/lib/analytics'
import AddToCartButton from './AddToCartButton'
import type { CartItem } from '@/lib/cart'

// Barra fixa no rodapé do celular com preço, "Matricular" e WhatsApp.
// Aparece depois que o cartão de preço sai da tela.
export default function StickyBuyBar({ item, price, installments, installmentValue, whatsappHref }:
  { item: CartItem; price: number; installments?: number; installmentValue?: number; whatsappHref: string }) {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const target = document.getElementById('cartao-preco')
    if (!target || !('IntersectionObserver' in window)) { setShow(true); return }
    const obs = new IntersectionObserver(([e]) => setShow(!e.isIntersecting && e.boundingClientRect.top < 0), { threshold: 0 })
    obs.observe(target)
    return () => obs.disconnect()
  }, [])

  return (
    <div className={`md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-gray-200 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] px-4 py-3 transition-transform duration-300 ${show ? 'translate-y-0' : 'translate-y-full'}`}
      style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}>
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          {price > 0 ? (
            <>
              <p className="text-lg font-black text-primary-900 leading-none">{brl(price)}</p>
              {installmentValue ? <p className="text-[11px] text-gray-500 mt-0.5">ou {installments}x de {brl(installmentValue)}</p> : null}
            </>
          ) : <p className="text-sm font-semibold text-primary-800">Consulte condições</p>}
        </div>
        <a href={whatsappHref} target="_blank" rel="noopener noreferrer" aria-label="Tirar dúvidas no WhatsApp"
          onClick={() => track('whatsapp_click', { location: 'barra_fixa_curso', item_id: item.course_id })}
          className="w-11 h-11 rounded-lg bg-green-500 text-white flex items-center justify-center shrink-0">
          <MessageCircle size={20} />
        </a>
        {price > 0 && (
          <>
            <AddToCartButton item={item} compact className="w-11 h-11 shrink-0" />
            <Link href={`/checkout?curso=${item.course_id}`} className="btn-primary py-2.5 px-4 text-sm shadow-none shrink-0">Matricular</Link>
          </>
        )}
      </div>
    </div>
  )
}
