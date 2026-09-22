// Configuração pública do site (SEO, canonical, Schema.org)
export const SITE_URL = (process.env.SITE_URL || process.env.NEXT_PUBLIC_APP_URL || 'https://academypopeduca.com.br')
  .replace(/\/$/, '')
  .replace(/^http:\/\/localhost.*/, 'https://academypopeduca.com.br')

export const SITE_NAME = 'Academy Pop'

export const DEFAULT_DESCRIPTION =
  'Cursos EAD reconhecidos pelo MEC: EJA, cursos técnicos, graduação e pós-graduação 100% online, com certificado de validade nacional e atendimento humanizado.'

export function absoluteUrl(path = '/') {
  if (!path) return SITE_URL
  if (/^https?:\/\//.test(path)) return path
  return `${SITE_URL}${path.startsWith('/') ? '' : '/'}${path}`
}

export const brl = (n: number | string | null | undefined) =>
  Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

export function stripHtml(html?: string | null, max = 160) {
  const text = String(html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
  return text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text
}

export function whatsappLink(number?: string | null, message?: string) {
  const n = String(number || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')
  if (!n) return '#'
  return `https://wa.me/${n}${message ? `?text=${encodeURIComponent(message)}` : ''}`
}
