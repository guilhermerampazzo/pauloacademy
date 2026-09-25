'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard, BookOpen, Users, FileText, Tag, ShoppingBag, LogOut, GraduationCap, Settings, MessageSquareQuote, Newspaper, Search, KeyRound, CalendarClock, Handshake
} from 'lucide-react'
import { removeToken } from '@/lib/auth'
import clsx from 'clsx'

const links = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard, exact: true },
  { href: '/admin/cursos', label: 'Cursos', icon: BookOpen },
  { href: '/admin/professores', label: 'Professores', icon: Users },
  { href: '/admin/conteudo', label: 'Conteúdo', icon: FileText },
  { href: '/admin/depoimentos', label: 'Depoimentos', icon: MessageSquareQuote },
  { href: '/admin/blog', label: 'Blog', icon: Newspaper },
  { href: '/admin/parceiros', label: 'Parceiros', icon: Handshake },
  { href: '/admin/cupons', label: 'Cupons', icon: Tag },
  { href: '/admin/pedidos', label: 'Pedidos', icon: ShoppingBag },
  { href: '/admin/tmb', label: 'Pagamentos TMB', icon: CalendarClock },
  { href: '/admin/buscas', label: 'Buscas no site', icon: Search },
  { href: '/admin/senha', label: 'Segurança da conta', icon: KeyRound },
]

export default function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  const handleLogout = () => {
    removeToken()
    document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
    router.push('/admin/login')
  }

  return (
    <aside className="w-64 bg-primary-950 text-white flex flex-col min-h-screen shrink-0">
      <div className="p-5 border-b border-primary-800">
        <Link href="/admin" className="flex items-center gap-2 font-bold text-lg">
          <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center">
            <GraduationCap size={20} />
          </div>
          <span>Academy<span className="text-accent-400">Pop</span></span>
        </Link>
        <p className="text-blue-400 text-xs mt-1">Painel Administrativo</p>
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {links.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href)
          return (
            <Link
              key={href}
              href={href}
              className={clsx(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all',
                active ? 'bg-accent-600 text-white' : 'text-blue-300 hover:bg-primary-800 hover:text-white'
              )}
            >
              <Icon size={18} />
              {label}
            </Link>
          )
        })}
      </nav>

      <div className="p-4 border-t border-primary-800 space-y-1">
        <Link href="/" target="_blank"
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-300 hover:bg-primary-800 hover:text-white transition-all">
          <Settings size={18} /> Ver site
        </Link>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-blue-300 hover:bg-red-900/50 hover:text-red-300 transition-all"
        >
          <LogOut size={18} /> Sair
        </button>
      </div>
    </aside>
  )
}
