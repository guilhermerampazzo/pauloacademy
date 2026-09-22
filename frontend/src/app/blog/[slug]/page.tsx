import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { SiteHeader, SiteFooter } from '@/components/public/Site'
import Breadcrumbs from '@/components/public/Breadcrumbs'
import WhatsAppButton from '@/components/public/WhatsAppButton'
import CourseCard from '@/components/public/CourseCard'
import JsonLd from '@/components/JsonLd'
import { getContent, getPost } from '@/lib/data'
import { articleSchema } from '@/lib/schema'
import { getCategoryInfo, categoryHref } from '@/lib/categories'

export const revalidate = 120

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPost(params.slug)
  if (!post) return { title: 'Post não encontrado', robots: { index: false } }
  const title = post.seo_title || post.title
  const description = post.seo_description || post.excerpt || undefined
  return {
    title,
    description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      type: 'article', title, description, url: `/blog/${post.slug}`,
      publishedTime: post.published_at, modifiedTime: post.updated_at,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  }
}

export default async function PostPage({ params }: { params: { slug: string } }) {
  const [post, content] = await Promise.all([getPost(params.slug), getContent()])
  if (!post) notFound()
  const footer = (content.footer || {}) as Record<string, string>
  const cat = post.related_category ? getCategoryInfo(post.related_category) : null

  return (
    <>
      <SiteHeader />
      <article>
        <header className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-4">
            <Breadcrumbs items={[{ name: 'Início', path: '/' }, { name: 'Blog', path: '/blog' }, { name: post.title, path: `/blog/${post.slug}` }]} />
            <h1 className="text-3xl md:text-4xl font-black leading-tight">{post.title}</h1>
            {post.excerpt && <p className="text-blue-100 text-lg mt-4">{post.excerpt}</p>}
            <p className="text-blue-300 text-sm mt-4">
              {post.author ? `${post.author} · ` : ''}{post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : ''}
            </p>
          </div>
        </header>
        {post.cover_image && (
          <div className="max-w-4xl mx-auto px-4 -mt-6">
            <div className="relative aspect-[2/1] rounded-2xl overflow-hidden shadow-xl">
              <Image src={post.cover_image} alt="" fill priority sizes="(min-width: 896px) 896px, 100vw" className="object-cover" />
            </div>
          </div>
        )}
        <div className="max-w-3xl mx-auto px-4 py-12 prose-content text-lg" dangerouslySetInnerHTML={{ __html: post.content || '' }} />
      </article>

      {!!post.related_courses?.length && (
        <section className="py-14 bg-gray-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between mb-8 gap-4">
              <h2 className="text-2xl md:text-3xl font-bold text-primary-900">{cat ? `Cursos de ${cat.label}` : 'Cursos recomendados'}</h2>
              <Link href={cat ? categoryHref(cat.name) : '/cursos'} className="text-sm font-semibold text-accent-700 hover:underline">Ver todos →</Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {post.related_courses.map(c => <CourseCard key={c.id} course={c} />)}
            </div>
          </div>
        </section>
      )}

      <JsonLd data={articleSchema(post)} />
      <SiteFooter />
      <WhatsAppButton number={footer.whatsapp} context={`o artigo "${post.title}"`} />
    </>
  )
}
