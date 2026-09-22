'use client'
import { ShoppingCart, Check } from 'lucide-react'
import { useCart, type CartItem } from '@/lib/cart'

// Botão "Adicionar ao carrinho" (card, página do curso, barra fixa do celular)
export default function AddToCartButton({ item, className = '', compact = false }: { item: CartItem; className?: string; compact?: boolean }) {
  const { add, has, ready, setOpen } = useCart()
  const inCart = ready && has(item.course_id)
  return (
    <button
      type="button"
      onClick={e => { e.preventDefault(); e.stopPropagation(); if (inCart) setOpen(true); else add(item) }}
      className={`inline-flex items-center justify-center gap-2 font-semibold rounded-lg transition-colors ${inCart ? 'bg-green-50 text-green-700 border-2 border-green-200' : 'bg-white text-primary-800 border-2 border-primary-800 hover:bg-primary-50'} ${className}`}
      aria-label={inCart ? `${item.title} já está no carrinho` : `Adicionar ${item.title} ao carrinho`}
    >
      {inCart ? <Check size={16} /> : <ShoppingCart size={16} />}
      {!compact && (inCart ? 'No carrinho' : 'Adicionar ao carrinho')}
    </button>
  )
}
