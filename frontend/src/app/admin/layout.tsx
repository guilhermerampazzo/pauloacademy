import type { Metadata } from 'next'
import AdminShell from '@/components/admin/AdminShell'

// v2.4: o painel nunca é pré-gerado nem guardado em cache.
// Antes, /admin, /admin/cursos e /admin/conteudo saíam como páginas estáticas com
// "Cache-Control: s-maxage=31536000" (1 ano). Um cache na frente do servidor guardou a
// versão anterior à 2.3 e continuava entregando: menu sem Blog e telas carregando sem parar.
export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Painel',
  robots: { index: false, follow: false },
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <AdminShell>{children}</AdminShell>
}
