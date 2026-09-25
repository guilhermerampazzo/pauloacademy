'use client'
import { usePathname } from 'next/navigation'
import Sidebar from './Sidebar'

// v2.4: casca do painel (menu lateral). O layout em app/admin/layout.tsx é um componente
// de servidor só para poder declarar a rota como dinâmica (sem cache).
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()

  if (['/admin/login', '/admin/esqueci-senha', '/admin/redefinir-senha'].includes(pathname)) {
    return <>{children}</>
  }

  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar />
      <main className="flex-1 overflow-auto min-h-screen">
        {children}
      </main>
    </div>
  )
}
