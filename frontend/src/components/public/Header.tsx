'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, GraduationCap, Instagram, Facebook, Youtube, Search, ShoppingCart, ChevronDown } from 'lucide-react'
import { getCategoryInfo, categoryHref, GRADUACAO_MENU, GRADUACAO_NAMES } from '@/lib/categories'
import { useCart } from '@/lib/cart'
import { whatsappLink } from '@/lib/site'
import { track } from '@/lib/analytics'
import SearchBox from './SearchBox'
import CartDrawer from './CartDrawer'

interface SocialData {
  instagram?: string
  facebook?: string
  youtube?: string
  whatsapp?: string
}

interface Props {
  socialData?: SocialData
  /** categorias reais do banco: o menu é montado a partir delas (antes era fixo e tinha links quebrados) */
  categories?: { category: string; count: number }[]
}

export default function Header({ socialData, categories = [] }: Props) {
  const [open, setOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [gradOpen, setGradOpen] = useState(false)
  const [gradMobile, setGradMobile] = useState(false)
  const pathname = usePathname()
  const { count, ready, setOpen: setCartOpen } = useCart()
  const d = socialData || {}

  // Fecha menus ao trocar de página
  useEffect(() => { setOpen(false); setSearchOpen(false); setGradOpen(false) }, [pathname])

  // Atalho "/" abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Categorias soltas no menu; Bacharelado, Tecnólogo e Superior Sequencial ficam no dropdown "Graduação"
  const countOf = (name: string) => categories.find(c => c.category === name)?.count || 0
  const nav = categories.filter(c => !GRADUACAO_NAMES.has(c.category))
    .map(c => ({ ...getCategoryInfo(c.category), count: c.count }))
    .sort((a, b) => a.order - b.order)
  const navBefore = nav.filter(c => c.order < 3)   // EJA, Técnico
  const navAfter = nav.filter(c => c.order >= 3)   // Pós-Graduação e outras
  const grad = GRADUACAO_MENU.map(g => ({ ...g, href: categoryHref(g.name), count: countOf(g.name) }))
  const gradActive = grad.some(g => pathname === g.href)

  const link = (c: { slug: string; name: string; label: string }) => (
    <Link key={c.slug} href={categoryHref(c.name)}
      className={`text-sm transition-colors ${pathname === categoryHref(c.name) ? 'text-white font-semibold' : 'text-blue-200 hover:text-white'}`}>
      {c.label}
    </Link>
  )

  const social = (size: number, cls: string) => (
    <>
      {d.instagram && <a href={d.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram" className={cls}><Instagram size={size} /></a>}
      {d.facebook && <a href={d.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook" className={cls}><Facebook size={size} /></a>}
      {d.youtube && <a href={d.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube" className={cls}><Youtube size={size} /></a>}
    </>
  )

  return (
    <>
      <header className="bg-primary-900 text-white sticky top-0 z-50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-4">
            <Link href="/" className="flex items-center gap-2 font-bold text-xl shrink-0" aria-label="Academy Pop – início">
              <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center">
                <GraduationCap size={22} className="text-white" />
              </div>
              <span>Academy<span className="text-accent-400">Pop</span></span>
            </Link>

            <nav className="hidden lg:flex items-center gap-5" aria-label="Categorias de cursos">
              {navBefore.map(link)}
              <div className="relative" onMouseEnter={() => setGradOpen(true)} onMouseLeave={() => setGradOpen(false)}>
                <button type="button" onClick={() => setGradOpen(v => !v)} aria-expanded={gradOpen} aria-haspopup="true"
                  className={`flex items-center gap-1 text-sm transition-colors ${gradActive ? 'text-white font-semibold' : 'text-blue-200 hover:text-white'}`}>
                  Graduação <ChevronDown size={14} className={`transition-transform ${gradOpen ? 'rotate-180' : ''}`} />
                </button>
                {gradOpen && (
                  <div className="absolute top-full left-0 pt-2 min-w-[220px] z-50">
                    <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1.5">
                      {grad.map(g => (
                        <Link key={g.href} href={g.href} onClick={() => setGradOpen(false)}
                          className={`flex items-center justify-between gap-4 px-4 py-2 text-sm hover:bg-primary-50 ${pathname === g.href ? 'text-accent-700 font-semibold' : 'text-primary-900'}`}>
                          {g.label}
                          {g.count > 0 && <span className="text-xs text-gray-400">{g.count}</span>}
                        </Link>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {navAfter.map(link)}
              <Link href="/cursos" className="text-sm text-blue-200 hover:text-white">Todos os cursos</Link>
              <Link href="/blog" className={`text-sm transition-colors ${pathname?.startsWith('/blog') ? 'text-white font-semibold' : 'text-blue-200 hover:text-white'}`}>Blog</Link>
            </nav>

            <div className="flex items-center gap-1 sm:gap-2">
              <button type="button" onClick={() => setSearchOpen(v => !v)} aria-label="Buscar cursos"
                className="hidden md:flex items-center gap-2 text-sm text-blue-200 hover:text-white bg-primary-800 hover:bg-primary-700 rounded-lg px-3 py-2 transition-colors">
                <Search size={16} /> <span className="hidden xl:inline">Buscar curso</span>
                <kbd className="hidden xl:inline text-[10px] bg-primary-900 rounded px-1.5 py-0.5 text-blue-300">/</kbd>
              </button>
              <button type="button" onClick={() => setSearchOpen(true)} aria-label="Buscar cursos" className="md:hidden p-2 rounded-lg hover:bg-primary-800">
                <Search size={22} />
              </button>

              <button type="button" onClick={() => setCartOpen(true)} aria-label={`Carrinho com ${count} curso(s)`}
                className="relative p-2 rounded-lg hover:bg-primary-800">
                <ShoppingCart size={22} />
                {ready && count > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 bg-accent-500 text-white text-[11px] font-bold rounded-full flex items-center justify-center">
                    {count}
                  </span>
                )}
              </button>

              <div className="hidden md:flex items-center gap-1">
                {social(18, 'w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary-700 transition-colors text-blue-300 hover:text-white')}
              </div>
              <a href={whatsappLink(d.whatsapp, 'Olá! Vim pelo site da Academy Pop e gostaria de falar com um consultor.')}
                target="_blank" rel="noopener noreferrer"
                onClick={() => track('whatsapp_click', { location: 'header' })}
                className="hidden md:inline-flex btn-primary text-sm py-2">
                Fale Conosco
              </a>

              <button onClick={() => setOpen(!open)} className="lg:hidden p-2 rounded-lg hover:bg-primary-800" aria-label="Abrir menu" aria-expanded={open}>
                {open ? <X size={24} /> : <Menu size={24} />}
              </button>
            </div>
          </div>
        </div>

        {/* Busca: faixa abaixo do cabeçalho (desktop) / tela cheia (celular) */}
        {searchOpen && (
          <div className="fixed inset-0 md:absolute md:inset-auto md:left-0 md:right-0 md:top-full bg-primary-950/95 md:bg-primary-900 md:border-t md:border-primary-800 z-50">
            <div className="max-w-3xl mx-auto px-4 py-4 md:py-5">
              <div className="flex items-center gap-2 mb-3 md:hidden">
                <p className="flex-1 font-semibold">Buscar cursos</p>
                <button onClick={() => setSearchOpen(false)} className="p-2" aria-label="Fechar busca"><X size={22} /></button>
              </div>
              <div className="flex items-start gap-2">
                <SearchBox variant="header" categories={categories} whatsapp={d.whatsapp} autoFocus onNavigate={() => setSearchOpen(false)} />
                <button onClick={() => setSearchOpen(false)} className="hidden md:block p-2.5 text-blue-200 hover:text-white" aria-label="Fechar busca"><X size={20} /></button>
              </div>
            </div>
          </div>
        )}

        {open && (
          <div className="lg:hidden bg-primary-800 border-t border-primary-700 px-4 py-4 space-y-1">
            {navBefore.map(c => (
              <Link key={c.slug} href={categoryHref(c.name)} className="flex justify-between text-blue-100 hover:text-white py-2">
                {c.label} <span className="text-blue-300 text-sm">{c.count}</span>
              </Link>
            ))}
            <button type="button" onClick={() => setGradMobile(v => !v)} aria-expanded={gradMobile}
              className="flex items-center justify-between w-full text-blue-100 hover:text-white py-2">
              Graduação <ChevronDown size={16} className={`transition-transform ${gradMobile ? 'rotate-180' : ''}`} />
            </button>
            {gradMobile && (
              <div className="pl-4 border-l border-primary-600 ml-1">
                {grad.map(g => (
                  <Link key={g.href} href={g.href} className="flex justify-between text-blue-200 hover:text-white py-1.5 text-sm">
                    {g.label} {g.count > 0 && <span className="text-blue-300">{g.count}</span>}
                  </Link>
                ))}
              </div>
            )}
            {navAfter.map(c => (
              <Link key={c.slug} href={categoryHref(c.name)} className="flex justify-between text-blue-100 hover:text-white py-2">
                {c.label} <span className="text-blue-300 text-sm">{c.count}</span>
              </Link>
            ))}
            <Link href="/cursos" className="block text-blue-100 hover:text-white py-2">Todos os cursos</Link>
            <div className="border-t border-primary-700 my-2" />
            <Link href="/como-funciona" className="block text-blue-300 hover:text-white py-1.5 text-sm">Como funciona</Link>
            <Link href="/reconhecimento-mec" className="block text-blue-300 hover:text-white py-1.5 text-sm">Reconhecimento MEC</Link>
            <Link href="/blog" className="block text-blue-300 hover:text-white py-1.5 text-sm">Blog</Link>
            <Link href="/sobre-nos" className="block text-blue-300 hover:text-white py-1.5 text-sm">Sobre nós</Link>
            <div className="flex gap-3 pt-2">
              {social(18, 'w-9 h-9 bg-primary-700 rounded-lg flex items-center justify-center text-blue-300 hover:text-white')}
            </div>
            <a href={whatsappLink(d.whatsapp, 'Olá! Vim pelo site da Academy Pop e gostaria de falar com um consultor.')}
              target="_blank" rel="noopener noreferrer"
              onClick={() => track('whatsapp_click', { location: 'menu_mobile' })}
              className="btn-primary text-sm py-2.5 mt-3 w-full justify-center">
              Fale Conosco
            </a>
          </div>
        )}
      </header>
      <CartDrawer />
    </>
  )
}
