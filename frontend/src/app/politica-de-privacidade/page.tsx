import type { Metadata } from 'next'
import LegalPage from '@/components/public/LegalPage'
import { getContent } from '@/lib/data'

// v2: antes o link do rodapé apontava para "#"
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Política de Privacidade',
  alternates: { canonical: '/politica-de-privacidade' },
}

export default async function Page() {
  const content = await getContent()
  const data = (content.privacidade || {}) as { title?: string; html?: string; updated_at?: string }
  return <LegalPage title={data.title || 'Política de Privacidade'} html={data.html || '<p>Em atualização.</p>'} updatedAt={data.updated_at} path="/politica-de-privacidade" />
}
