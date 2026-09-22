'use client'
// Eventos para GA4 (gtag) e Meta Pixel (fbq). Os IDs são cadastrados no admin
// (Conteúdo > Rastreamento). Se nenhum estiver configurado, as chamadas não fazem nada.

type Params = Record<string, unknown>

const FB_MAP: Record<string, string> = {
  view_item: 'ViewContent',
  add_to_cart: 'AddToCart',
  begin_checkout: 'InitiateCheckout',
  purchase: 'Purchase',
  search: 'Search',
  generate_lead: 'Lead',
  whatsapp_click: 'Contact',
}

export function track(event: string, params: Params = {}) {
  if (typeof window === 'undefined') return
  const w = window as unknown as { gtag?: (...a: unknown[]) => void; fbq?: (...a: unknown[]) => void }
  try { w.gtag?.('event', event, params) } catch { /* ignore */ }
  try {
    const fb = FB_MAP[event]
    if (fb && w.fbq) {
      const value = typeof params.value === 'number' ? params.value : undefined
      w.fbq('track', fb, { value, currency: value !== undefined ? 'BRL' : undefined, search_string: params.search_term })
    }
  } catch { /* ignore */ }
}
