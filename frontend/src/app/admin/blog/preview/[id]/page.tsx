'use client'
// v2.3: pré-visualização do artigo antes de publicar.
// Antes só dava para ver o post depois de publicado (rascunho e post agendado
// devolvem 404 no site, por segurança). Esta tela usa o mesmo visual do artigo
// publicado, mas lê pelo painel (com login), sem expor o rascunho ao público.
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Loader2, Eye, EyeOff, Clock } from 'lucide-react'
import api from '@/lib/api'

interface Post {
  id: number; slug: string; title: string; excerpt: string; content: string
  cover_image: string; related_category: string; author: string
  published: boolean; published_at: string | null
  seo_title: string; seo_description: string
}

export default function PreviewPostPage({ params }: { params: { id: string } }) {
  const [post, setPost] = useState<Post | null>(null)
  const [erro, setErro] = useState('')

  useEffect(() => {
    api.get(`/blog/admin/${params.id}`)
      .then(r => setPost(r.data))
      .catch(() => setErro('Não foi possível carregar este post.'))
  }, [params.id])

  if (erro) return <div className="p-8 text-gray-500">{erro}</div>
  if (!post) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>

  const agendado = !!post.published_at && new Date(post.published_at).getTime() > Date.now()
  const noAr = post.published && !agendado
  const data = post.published_at ? new Date(post.published_at).toLocaleString('pt-BR') : '—'

  return (
    <div className="pb-16">
      {/* Barra do painel (não aparece no site) */}
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-6 py-3 flex flex-wrap items-center gap-3">
        <Link href="/admin/blog" className="flex items-center gap-1 text-sm text-gray-500 hover:text-primary-700">
          <ArrowLeft size={16} /> Voltar para o blog
        </Link>
        <span className="text-gray-300">|</span>
        <span className={`flex items-center gap-1.5 text-sm font-medium ${noAr ? 'text-green-600' : 'text-gray-500'}`}>
          {noAr ? <Eye size={16} /> : agendado ? <Clock size={16} /> : <EyeOff size={16} />}
          {noAr ? 'No ar' : agendado ? `Agendado para ${data}` : 'Rascunho (só você vê esta tela)'}
        </span>
        <span className="text-xs text-gray-400">/blog/{post.slug}</span>
        {noAr && (
          <a href={`/blog/${post.slug}`} target="_blank" rel="noopener noreferrer"
            className="ml-auto text-sm font-semibold text-accent-700 hover:underline">Abrir no site →</a>
        )}
      </div>

      {/* Como o artigo aparece para o leitor */}
      <article className="bg-white">
        <header className="bg-gradient-to-br from-primary-900 to-primary-800 text-white py-12 md:py-16">
          <div className="max-w-3xl mx-auto px-4">
            <p className="text-blue-300 text-sm mb-4">Início / Blog</p>
            <h1 className="text-3xl md:text-4xl font-black leading-tight">{post.title || '(sem título)'}</h1>
            {post.excerpt && <p className="text-blue-100 text-lg mt-4">{post.excerpt}</p>}
            <p className="text-blue-300 text-sm mt-4">
              {post.author ? `${post.author} · ` : ''}
              {post.published_at ? new Date(post.published_at).toLocaleDateString('pt-BR') : 'sem data de publicação'}
            </p>
          </div>
        </header>

        {post.cover_image && (
          <div className="max-w-4xl mx-auto px-4 -mt-6">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.cover_image} alt="" className="w-full aspect-[2/1] object-cover rounded-2xl shadow-xl" />
          </div>
        )}

        <div className="max-w-3xl mx-auto px-4 py-12 prose-content text-lg"
          dangerouslySetInnerHTML={{ __html: post.content || '<p>(sem conteúdo)</p>' }} />
      </article>

      {/* Conferência rápida do que vai para o Google */}
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-gray-50 border border-gray-200 rounded-xl p-5 text-sm space-y-2">
          <p className="font-semibold text-gray-900">Como deve aparecer no Google</p>
          <p className="text-[#1a0dab] text-lg leading-tight">{post.seo_title || post.title}</p>
          <p className="text-green-700 text-xs">academypopeduca.com.br › blog › {post.slug}</p>
          <p className="text-gray-600">{post.seo_description || post.excerpt || '(sem descrição)'}</p>
          <p className="text-xs text-gray-400 pt-2">
            Título: {(post.seo_title || post.title || '').length}/60 ·
            Descrição: {(post.seo_description || post.excerpt || '').length}/155 ·
            Categoria relacionada: {post.related_category || 'nenhuma'}
          </p>
        </div>
      </div>
    </div>
  )
}
