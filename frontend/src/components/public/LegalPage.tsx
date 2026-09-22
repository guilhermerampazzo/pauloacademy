import { SiteHeader, SiteFooter } from './Site'
import Breadcrumbs from './Breadcrumbs'

// Páginas de texto (Política de Privacidade, Termos de Uso), editáveis em Admin > Conteúdo
export default function LegalPage({ title, html, updatedAt, path }: { title: string; html: string; updatedAt?: string; path: string }) {
  return (
    <>
      <SiteHeader />
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12">
        <div className="max-w-3xl mx-auto px-4">
          <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: title, path }]} />
          <h1 className="text-3xl md:text-4xl font-black">{title}</h1>
          {updatedAt && <p className="text-blue-200 text-sm mt-2">Atualizado em {new Date(updatedAt).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}</p>}
        </div>
      </section>
      <section className="py-12 bg-white">
        <div className="max-w-3xl mx-auto px-4 prose-content" dangerouslySetInnerHTML={{ __html: html }} />
      </section>
      <SiteFooter />
    </>
  )
}
