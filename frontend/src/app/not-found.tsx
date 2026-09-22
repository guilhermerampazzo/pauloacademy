import Link from 'next/link'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import SearchBox from '@/components/public/SearchBox'
import { getCategories, getContent } from '@/lib/data'
import { getCategoryInfo, categoryHref, sortCategories } from '@/lib/categories'

// v2: 404 com menu, busca e atalhos para as categorias (antes: página isolada sem navegação)
export default async function NotFound() {
  const [categories, content] = await Promise.all([getCategories(), getContent()])
  const footer = (content.footer || {}) as Record<string, string>
  return (
    <>
      <SiteHeader />
      <section className="relative z-20 bg-gradient-to-br from-primary-900 to-primary-800 text-white py-16 md:py-24">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <p className="text-7xl font-black text-primary-600 mb-2">404</p>
          <h1 className="text-2xl md:text-3xl font-bold mb-3">Página não encontrada</h1>
          <p className="text-blue-200 mb-8">O endereço pode ter mudado. Busque o curso que você procura:</p>
          <SearchBox variant="hero" categories={categories} whatsapp={footer.whatsapp} />
          <div className="flex flex-wrap justify-center gap-3 mt-8">
            {sortCategories(categories).map(c => (
              <Link key={c.category} href={categoryHref(c.category)} className="px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-sm font-semibold">
                {getCategoryInfo(c.category).label}
              </Link>
            ))}
            <Link href="/" className="px-4 py-2 rounded-full bg-accent-500 hover:bg-accent-600 text-sm font-semibold">Página inicial</Link>
          </div>
        </div>
      </section>
      <SiteFooter />
    </>
  )
}
