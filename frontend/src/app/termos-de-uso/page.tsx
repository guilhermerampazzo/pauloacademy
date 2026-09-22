import type { Metadata } from 'next'
import LegalPage from '@/components/public/LegalPage'
import { getContent } from '@/lib/data'

// v2: antes o link do rodapé apontava para "#"
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Termos de Uso',
  alternates: { canonical: '/termos-de-uso' },
}

export default async function Page() {
  const content = await getContent()
  const data = (content.termos || {}) as { title?: string; html?: string; updated_at?: string }
  return <LegalPage title={data.title || 'Termos de Uso'} html={data.html || '<p>Em atualização.</p>'} updatedAt={data.updated_at} path="/termos-de-uso" />
}
