'use client'
// v2: gestão do blog (conteúdo de topo de funil para SEO)
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Save, ExternalLink, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import ImageUpload from '@/components/admin/ImageUpload'
import RichTextEditor from '@/components/admin/RichTextEditor'

interface Post {
  id?: number; slug?: string; title: string; excerpt: string; content: string; cover_image: string
  related_category: string; author: string; published: boolean; published_at: string
  seo_title: string; seo_description: string
}
const empty: Post = { title: '', slug: '', excerpt: '', content: '', cover_image: '', related_category: '', author: '', published: false, published_at: '', seo_title: '', seo_description: '' }

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<(Post & { id: number; slug: string })[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Post | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => Promise.all([
    api.get('/blog/admin/all').then(r => setPosts(r.data)),
    api.get('/courses/categories').then(r => setCategories(r.data.map((c: { category: string }) => c.category))),
  ]).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k: keyof Post, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f)

  const save = async () => {
    if (!form?.title.trim()) { toast.error('Título obrigatório'); return }
    setSaving(true)
    try {
      const body = { ...form, published_at: form.published_at || null }
      if (form.id) await api.put(`/blog/${form.id}`, body)
      else await api.post('/blog', body)
      toast.success('Post salvo'); setForm(null); load()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      toast.error(msg || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('Remover este post?')) return
    await api.delete(`/blog/${id}`); toast.success('Removido'); load()
  }

  const edit = async (id: number) => {
    const r = await api.get(`/blog/admin/${id}`)
    const p = r.data
    setForm({ ...empty, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])), published: !!p.published, published_at: p.published_at ? String(p.published_at).slice(0, 16) : '' } as Post)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
          <p className="text-gray-500">Artigos que atraem visitantes pelo Google e levam aos cursos.</p>
        </div>
        {!form && <button onClick={() => setForm(empty)} className="btn-primary"><Plus size={18} /> Novo post</button>}
      </div>

      {form && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
          <div className="flex justify-between"><h2 className="font-bold">{form.id ? 'Editar' : 'Novo'} post</h2>
            <button onClick={() => setForm(null)} className="text-gray-400"><X size={18} /></button></div>
          <div><label className="label">Título *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex.: Como terminar o Ensino Médio online pelo EJA" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Endereço (slug)</label><input className="input" value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="gerado a partir do título" /></div>
            <div><label className="label">Autor</label><input className="input" value={form.author} onChange={e => set('author', e.target.value)} /></div>
          </div>
          <div><label className="label">Resumo (aparece na lista e no Google)</label><textarea className="input" rows={2} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} /></div>
          <div><label className="label">Conteúdo</label><RichTextEditor value={form.content} onChange={v => set('content', v)} /></div>
          <ImageUpload value={form.cover_image} onChange={v => set('cover_image', v)} label="Imagem de capa" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Categoria de cursos relacionada</label>
              <select className="input" value={form.related_category} onChange={e => set('related_category', e.target.value)}>
                <option value="">Nenhuma (mostra cursos em destaque)</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div><label className="label">Data de publicação</label><input type="datetime-local" className="input" value={form.published_at} onChange={e => set('published_at', e.target.value)} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Título SEO (até 60 caracteres)</label><input className="input" value={form.seo_title} onChange={e => set('seo_title', e.target.value)} /><p className="text-xs text-gray-400 mt-1">{form.seo_title.length}/60</p></div>
            <div><label className="label">Descrição SEO (até 155 caracteres)</label><textarea className="input" rows={2} value={form.seo_description} onChange={e => set('seo_description', e.target.value)} /><p className="text-xs text-gray-400 mt-1">{form.seo_description.length}/155</p></div>
          </div>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.published} onChange={e => set('published', e.target.checked)} /> Publicado</label>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
          : posts.length === 0 ? <p className="p-12 text-center text-gray-400">Nenhum post ainda. Sugestões: “Como terminar o Ensino Médio online (EJA)”, “Pós EAD tem o mesmo valor da presencial?”, “Como consultar se um curso é reconhecido pelo MEC”.</p>
          : posts.map(p => (
            <div key={p.id} className="p-5 flex items-center gap-4">
              {p.published ? <Eye size={18} className="text-green-500" /> : <EyeOff size={18} className="text-gray-300" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.title}</p>
                <p className="text-xs text-gray-400">/blog/{p.slug} · {p.published ? 'publicado' : 'rascunho'}</p>
              </div>
              {p.published && <a href={`/blog/${p.slug}`} target="_blank" className="p-2 text-gray-400 hover:text-primary-600"><ExternalLink size={16} /></a>}
              <button onClick={() => edit(p.id)} className="p-2 text-gray-400 hover:text-primary-600"><Edit size={16} /></button>
              <button onClick={() => remove(p.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
      </div>
    </div>
  )
}
