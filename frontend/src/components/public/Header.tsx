'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Menu, X, GraduationCap, Instagram, Facebook, Youtube, Search, ShoppingCart, ChevronDown } from 'lucide-react'
import { getCategoryInfo, categoryHref, MENU_GROUPS, MENU_SINGLE, isMenuCategory, GROUP_PAGES } from '@/lib/categories'
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
  // v2.4: menu retrátil – qual grupo está aberto (desktop) e quais estão abertos no celular
  const [openGroup, setOpenGroup] = useState<string | null>(null)
  const [mobileGroups, setMobileGroups] = useState<Record<string, boolean>>({})
  const pathname = usePathname()
  const { count, ready, setOpen: setCartOpen } = useCart()
  const d = socialData || {}

  // Fecha menus ao trocar de página
  useEffect(() => { setOpen(false); setSearchOpen(false); setOpenGroup(null) }, [pathname])

  // Atalho "/" abre a busca
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (e.key === '/' && tag !== 'INPUT' && tag !== 'TEXTAREA') { e.preventDefault(); setSearchOpen(true) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // Fecha o submenu aberto com Esc ou clique fora
  useEffect(() => {
    if (!openGroup) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenGroup(null) }
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement)?.closest?.('[data-menu-group]')) setOpenGroup(null)
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('click', onClick)
    return () => { window.removeEventListener('keydown', onKey); window.removeEventListener('click', onClick) }
  }, [openGroup])

  // v2.4: menu montado a partir de MENU_GROUPS (src/lib/categories.ts).
  // Categorias do banco que não estão no menu (ex.: criadas no admin) entram como itens soltos.
  const countOf = (name: string) => categories.find(c => c.category === name)?.count || 0
  const groupPageCats = new Set(Object.values(GROUP_PAGES).flatMap(g => g.categories))
  const groups = MENU_GROUPS.map(g => ({
    ...g,
    items: g.items.map(i => ({ ...i, href: categoryHref(i.name), count: countOf(i.name) })),
  }))
  const extra = categories
    .filter(c => !isMenuCategory(c.category) && !groupPageCats.has(c.category))
    .map(c => ({ name: c.category, label: getCategoryInfo(c.category).label }))
  const singles = [...MENU_SINGLE, ...extra].map(i => ({ ...i, href: categoryHref(i.name), count: countOf(i.name) }))

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
              {groups.map(g => {
                const isOpen = openGroup === g.label
                const active = g.items.some(i => pathname === i.href) || (g.slug === 'eja' && pathname === '/eja')
                return (
                  <div key={g.label} className="relative" data-menu-group
                    onMouseEnter={() => setOpenGroup(g.label)} onMouseLeave={() => setOpenGroup(v => (v === g.label ? null : v))}>
                    {/* clique abre (no computador o mouse já abre ao passar); fecha com Esc, clique fora ou ao sair com o mouse */}
                    <button type="button" onClick={() => setOpenGroup(g.label)}
                      aria-expanded={isOpen} aria-haspopup="true"
                      className={`flex items-center gap-1 text-sm transition-colors ${active ? 'text-white font-semibold' : 'text-blue-200 hover:text-white'}`}>
                      {g.label} <ChevronDown size={14} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                    {isOpen && (
                      <div className="absolute top-full left-0 pt-2 min-w-[240px] z-50">
                        <div className="bg-white rounded-lg shadow-xl border border-gray-100 py-1.5">
                          {g.items.map(i => (
                            <Link key={i.href} href={i.href} onClick={() => setOpenGroup(null)}
                              className={`flex items-center justify-between gap-4 px-4 py-2 text-sm hover:bg-primary-50 ${pathname === i.href ? 'text-accent-700 font-semibold' : 'text-primary-900'}`}>
                              {i.label}
                              {i.count > 0 && <span className="text-xs text-gray-400">{i.count}</span>}
                            </Link>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
              {singles.map(i => (
                <Link key={i.href} href={i.href}
                  className={`text-sm transition-colors ${pathname === i.href ? 'text-white font-semibold' : 'text-blue-200 hover:text-white'}`}>
                  {i.label}
                </Link>
              ))}
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
            {groups.map(g => {
              const isOpen = !!mobileGroups[g.label]
              return (
                <div key={g.label}>
                  <button type="button" onClick={() => setMobileGroups(m => ({ ...m, [g.label]: !m[g.label] }))} aria-expanded={isOpen}
                    className="flex items-center justify-between w-full text-blue-100 hover:text-white py-2.5">
                    {g.label} <ChevronDown size={16} className={`transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {isOpen && (
                    <div className="pl-4 border-l border-primary-600 ml-1 mb-1">
                      {g.items.map(i => (
                        <Link key={i.href} href={i.href} className="flex justify-between text-blue-200 hover:text-white py-2 text-sm">
                          {i.label} {i.count > 0 && <span className="text-blue-300">{i.count}</span>}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
            {singles.map(i => (
              <Link key={i.href} href={i.href} className="flex justify-between text-blue-100 hover:text-white py-2.5">
                {i.label} {i.count > 0 && <span className="text-blue-300 text-sm">{i.count}</span>}
              </Link>
            ))}
            <div className="border-t border-primary-700 my-2" />
            <Link href="/como-funciona" className="block text-blue-300 hover:text-white py-1.5 text-sm">Como funciona</Link>
            <Link href="/reconhecimento-mec" className="block text-blue-300 hover:text-white py-1.5 text-sm">Reconhecimento MEC</Link>
            <Link href="/blog" className="block text-blue-300 hover:text-white py-1.5 text-sm">Blog</Link>
            <Link href="/sobre-nos" className="block text-blue-300 hover:text-white py-1.5 text-sm">Sobre nós</Link>
            <Link href="/parceiros" className="block text-blue-300 hover:text-white py-1.5 text-sm">Parceiros</Link>
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
