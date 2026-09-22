import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import { getContent, getPosts } from '@/lib/data'
import { getCategoryInfo } from '@/lib/categories'

// v2: blog para conteúdo de topo de funil (SEO). Posts cadastrados em Admin > Blog.
export const revalidate = 120

export const metadata: Metadata = {
  title: 'Blog – dicas sobre EJA, cursos técnicos, graduação e pós EAD',
  description: 'Guias e respostas para quem quer voltar a estudar: EJA, cursos técnicos, graduação e pós-graduação EAD, reconhecimento MEC e carreira.',
  alternates: { canonical: '/blog' },
}

export default async function BlogPage() {
  const [posts, content] = await Promise.all([getPosts(60), getContent()])
  const footer = (content.footer || {}) as Record<string, string>
  return (
    <>
      <SiteHeader />
      <section className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: 'Blog', path: '/blog' }]} />
          <h1 className="text-3xl md:text-5xl font-black mb-3">Blog Academy Pop</h1>
          <p className="text-blue-100 text-lg max-w-2xl">Guias práticos para você voltar a estudar e escolher o curso certo.</p>
        </div>
      </section>
      <section className="py-14 bg-gray-50 min-h-[40vh]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {posts.length === 0 ? (
            <p className="text-center text-gray-500 py-16">Em breve, novos conteúdos por aqui.</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {posts.map((p, i) => (
                <Link key={p.id} href={`/blog/${p.slug}`} className="card group flex flex-col">
                  <div className="relative h-48 bg-primary-100">
                    {p.cover_image && <Image src={p.cover_image} alt="" fill priority={i < 3} sizes="(min-width: 1024px) 33vw, (min-width: 768px) 50vw, 100vw" className="object-cover" />}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    {p.related_category && <span className="text-xs font-semibold text-accent-700 uppercase tracking-wide mb-2">{getCategoryInfo(p.related_category).label}</span>}
                    <h2 className="font-bold text-lg text-primary-900 group-hover:text-accent-700 leading-snug">{p.title}</h2>
                    {p.excerpt && <p className="text-sm text-gray-500 mt-2 line-clamp-3 flex-1">{p.excerpt}</p>}
                    {p.published_at && <p className="text-xs text-gray-400 mt-4">{new Date(p.published_at).toLocaleDateString('pt-BR')}</p>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context="o blog" />
    </>
  )
}
