// Cabeçalho e rodapé "com dados": buscam conteúdo do CMS e categorias no servidor.
// Use <SiteHeader /> e <SiteFooter /> nas páginas públicas.
import Header from './Header'
import Footer from './Footer'
import { getCategories, getContent } from '@/lib/data'

export async function SiteHeader() {
  const [content, categories] = await Promise.all([getContent(), getCategories()])
  return <Header socialData={(content.footer || {}) as Record<string, string>} categories={categories} />
}

export async function SiteFooter() {
  const [content, categories] = await Promise.all([getContent(), getCategories()])
  return <Footer data={(content.footer || {}) as Record<string, string>} categories={categories} />
}
