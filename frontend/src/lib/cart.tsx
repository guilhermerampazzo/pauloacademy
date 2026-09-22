'use client'
// Carrinho de cursos. Fica salvo no navegador (localStorage) só como lista de
// cursos; preços e disponibilidade são SEMPRE recalculados no servidor
// (POST /api/orders/quote) no carrinho e no checkout.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { track } from './analytics'

export interface CartItem {
  course_id: number
  slug: string
  title: string
  cover_image?: string
  category?: string
  price_pix?: number
}

interface CartCtx {
  items: CartItem[]
  count: number
  ready: boolean
  open: boolean
  setOpen: (v: boolean) => void
  add: (item: CartItem, opts?: { openDrawer?: boolean }) => void
  remove: (courseId: number) => void
  clear: () => void
  has: (courseId: number) => boolean
}

const KEY = 'academypop_cart_v1'
const Ctx = createContext<CartCtx | null>(null)

function load(): CartItem[] {
  try {
    const raw = localStorage.getItem(KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter(i => i && Number(i.course_id) > 0).slice(0, 20) : []
  } catch {
    return []
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([])
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setItems(load())
    setReady(true)
    // sincroniza entre abas
    const onStorage = (e: StorageEvent) => { if (e.key === KEY) setItems(load()) }
    window.addEventListener('storage', onStorage)
    return () => window.removeEventListener('storage', onStorage)
  }, [])

  const persist = useCallback((next: CartItem[]) => {
    setItems(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* modo privado */ }
  }, [])

  const add = useCallback((item: CartItem, opts?: { openDrawer?: boolean }) => {
    setItems(prev => {
      if (prev.some(i => i.course_id === item.course_id)) return prev
      const next = [...prev, item].slice(0, 20)
      try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* ignore */ }
      return next
    })
    track('add_to_cart', { currency: 'BRL', value: Number(item.price_pix || 0), items: [{ item_id: String(item.course_id), item_name: item.title, item_category: item.category }] })
    if (opts?.openDrawer !== false) setOpen(true)
  }, [])

  const remove = useCallback((courseId: number) => {
    persist(items.filter(i => i.course_id !== courseId))
  }, [items, persist])

  const clear = useCallback(() => persist([]), [persist])
  const has = useCallback((courseId: number) => items.some(i => i.course_id === courseId), [items])

  const value = useMemo(() => ({ items, count: items.length, ready, open, setOpen, add, remove, clear, has }),
    [items, ready, open, add, remove, clear, has])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useCart() {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useCart precisa estar dentro de <CartProvider>')
  return ctx
}

// Cotação no servidor
export interface QuoteItem {
  course_id: number; slug: string; title: string; cover_image?: string; category?: string
  workload?: number; duration?: string; modality?: string; installments?: number
  unit_price: number; discount: number; final_price: number; coupon_applied: boolean
}
export interface Quote {
  items: QuoteItem[]
  unavailable: { course_id: number; title: string | null; reason: string }[]
  subtotal: number; discount: number; total: number
  coupon: { id: number; code: string; discount_percent: number } | null
  couponError: string | null
  maxInstallments: number
}

export async function fetchQuote(courseIds: number[], couponCode?: string, paymentMethod = 'pix'): Promise<Quote> {
  const res = await fetch('/api/orders/quote', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ course_ids: courseIds, coupon_code: couponCode || undefined, payment_method: paymentMethod }),
  })
  if (!res.ok) throw new Error('Erro ao calcular o carrinho')
  return res.json()
}
