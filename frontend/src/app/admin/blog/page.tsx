'use client'
// v2: gestão do blog (conteúdo de topo de funil para SEO)
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Save, ExternalLink, Eye, EyeOff, Monitor, CalendarClock, Send, FileText } from 'lucide-react'
import Link from 'next/link'
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

// v2.4: status do post. Agendado = publicado com data futura: o site só mostra a partir da data/hora
// (a lista do blog e a página do post se atualizam em até 2 minutos depois do horário).
type Status = 'rascunho' | 'agendado' | 'publicado'
function statusOf(p: { published: boolean; published_at?: string | null }): Status {
  if (!p.published) return 'rascunho'
  if (p.published_at && new Date(p.published_at).getTime() > Date.now()) return 'agendado'
  return 'publicado'
}
const fmt = (iso?: string | null) => iso ? new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : ''
// <input type="datetime-local"> trabalha no horário local (Brasília); a API recebe ISO em UTC
const toLocalInput = (iso?: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)
const BADGE: Record<Status, string> = {
  rascunho: 'bg-gray-100 text-gray-600',
  agendado: 'bg-amber-100 text-amber-800',
  publicado: 'bg-green-100 text-green-700',
}

export default function BlogAdminPage() {
  const [posts, setPosts] = useState<(Post & { id: number; slug: string })[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Post | null>(null)
  const [saving, setSaving] = useState<string | null>(null)
  const [scheduleAt, setScheduleAt] = useState('')
  const [showSchedule, setShowSchedule] = useState(false)

  const load = () => Promise.all([
    api.get('/blog/admin/all').then(r => setPosts(r.data)),
    api.get('/courses/categories').then(r => setCategories(r.data.map((c: { category: string }) => c.category))),
  ]).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k: keyof Post, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f)

  // mode: 'rascunho' | 'salvar' (mantém o status) | 'publicar' (agora) | 'agendar' (data/hora)
  const save = async (mode: 'rascunho' | 'salvar' | 'publicar' | 'agendar') => {
    if (!form?.title.trim()) { toast.error('Título obrigatório'); return }
    let published = form.published
    let published_at: string | null = form.published_at || null
    if (mode === 'rascunho') { published = false }
    if (mode === 'publicar') {
      published = true
      // já publicado mantém a data original; rascunho ou agendado passa a valer agora
      if (statusOf(form) !== 'publicado') published_at = new Date().toISOString()
    }
    if (mode === 'agendar') {
      const iso = fromLocalInput(scheduleAt)
      if (!iso || new Date(iso).getTime() <= Date.now() + 60_000) { toast.error('Escolha uma data e hora no futuro'); return }
      published = true
      published_at = iso
    }
    setSaving(mode)
    try {
      const body = { ...form, published, published_at }
      const r = form.id ? await api.put(`/blog/${form.id}`, body) : await api.post('/blog', body)
      const saved = r.data
      const st = statusOf(saved)
      toast.success(st === 'agendado' ? `Agendado para ${fmt(saved.published_at)}` : st === 'publicado' ? 'Publicado' : 'Rascunho salvo')
      // continua editando (com id), para poder pré-visualizar
      setForm(f => f ? { ...f, id: saved.id, slug: saved.slug, published: saved.published, published_at: saved.published_at || '' } : f)
      setShowSchedule(false)
      load()
    } catch (e) {
      const msg = (e as { response?: { data?: { error?: string } } }).response?.data?.error
      toast.error(msg || 'Erro ao salvar')
    } finally { setSaving(null) }
  }

  const remove = async (id: number) => {
    if (!confirm('Remover este post?')) return
    await api.delete(`/blog/${id}`); toast.success('Removido'); load()
  }

  const edit = async (id: number) => {
    const r = await api.get(`/blog/admin/${id}`)
    const p = r.data
    setForm({ ...empty, ...Object.fromEntries(Object.entries(p).map(([k, v]) => [k, v ?? ''])), published: !!p.published, published_at: p.published_at || '' } as Post)
    setScheduleAt(p.published_at && statusOf(p) === 'agendado' ? toLocalInput(p.published_at) : '')
    setShowSchedule(false)
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Blog</h1>
          <p className="text-gray-500">Artigos que atraem visitantes pelo Google e levam aos cursos.</p>
        </div>
        {!form && <button onClick={() => { setForm(empty); setScheduleAt(''); setShowSchedule(false) }} className="btn-primary"><Plus size={18} /> Novo post</button>}
      </div>

      {form && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
          <div className="flex justify-between items-center"><h2 className="font-bold flex items-center gap-2">{form.id ? 'Editar' : 'Novo'} post
            <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${BADGE[statusOf(form)]}`}>
              {statusOf(form) === 'agendado' ? `Agendado · ${fmt(form.published_at)}` : statusOf(form) === 'publicado' ? 'Publicado' : 'Rascunho'}
            </span></h2>
            <button onClick={() => setForm(null)} className="text-gray-400"><X size={18} /></button></div>
          <div><label className="label">Título *</label><input className="input" value={form.title} onChange={e => set('title', e.target.value)} placeholder="Ex.: Como terminar o Ensino Médio online pelo EJA" /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Endereço (slug)</label><input className="input" value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="gerado a partir do título" /></div>
            <div><label className="label">Autor</label><input className="input" value={form.author} onChange={e => set('author', e.target.value)} /></div>
          </div>
          <div><label className="label">Resumo (aparece na lista e no Google)</label><textarea className="input" rows={2} value={form.excerpt} onChange={e => set('excerpt', e.target.value)} /></div>
          <div>
            <label className="label">Conteúdo</label>
            <RichTextEditor value={form.content} onChange={v => set('content', v)} />
            <p className="text-xs text-gray-400 mt-1">
              Para vender dentro do texto: selecione a palavra, clique no ícone de corrente e busque o curso pelo nome — o endereço é preenchido sozinho.
            </p>
          </div>
          <ImageUpload value={form.cover_image} onChange={v => set('cover_image', v)} label="Imagem de capa" />
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Categoria de cursos relacionada</label>
              <select className="input" value={form.related_category} onChange={e => set('related_category', e.target.value)}>
                <option value="">Nenhuma (mostra cursos em destaque)</option>
                {categories.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="label">Data de publicação</label>
              <p className="input bg-gray-50 text-gray-500">{form.published_at ? fmt(form.published_at) : 'definida ao publicar'}</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Título SEO (até 60 caracteres)</label><input className="input" value={form.seo_title} onChange={e => set('seo_title', e.target.value)} /><p className="text-xs text-gray-400 mt-1">{form.seo_title.length}/60</p></div>
            <div><label className="label">Descrição SEO (até 155 caracteres)</label><textarea className="input" rows={2} value={form.seo_description} onChange={e => set('seo_description', e.target.value)} /><p className="text-xs text-gray-400 mt-1">{form.seo_description.length}/155</p></div>
          </div>
          {/* v2.4: salvar como rascunho, salvar, publicar agora ou agendar data e hora */}
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <button onClick={() => save('rascunho')} disabled={!!saving} className="btn-secondary !py-2.5">
              {saving === 'rascunho' ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />} Salvar como rascunho
            </button>
            <button onClick={() => save('salvar')} disabled={!!saving} className="btn-secondary !py-2.5" title="Salva sem mudar o status (rascunho, agendado ou publicado)">
              {saving === 'salvar' ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar
            </button>
            <button onClick={() => setShowSchedule(v => !v)} disabled={!!saving} className="btn-secondary !py-2.5">
              <CalendarClock size={16} /> Programar publicação
            </button>
            <button onClick={() => save('publicar')} disabled={!!saving} className="btn-primary !py-2.5">
              {saving === 'publicar' ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />} {statusOf(form) === 'publicado' ? 'Salvar e manter publicado' : 'Publicar agora'}
            </button>
          </div>
          {showSchedule && (
            <div className="flex flex-wrap items-end gap-3 p-4 rounded-xl bg-amber-50 border border-amber-200">
              <div>
                <label className="label">Publicar automaticamente em (horário de Brasília)</label>
                <input type="datetime-local" className="input" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} min={toLocalInput(new Date().toISOString())} />
              </div>
              <button onClick={() => save('agendar')} disabled={!!saving || !scheduleAt} className="btn-primary !py-2.5 disabled:opacity-50">
                {saving === 'agendar' ? <Loader2 size={16} className="animate-spin" /> : <CalendarClock size={16} />} Agendar
              </button>
              <p className="text-xs text-amber-800 w-full">O post fica salvo e aparece no site sozinho no dia e hora escolhidos (em até 2 minutos). Até lá, só você vê pela pré-visualização.</p>
            </div>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {form.id && (
              <Link href={`/admin/blog/preview/${form.id}`} target="_blank"
                className="flex items-center gap-2 text-sm font-semibold text-primary-700 hover:underline">
                <Monitor size={16} /> Ver como vai ficar
              </Link>
            )}
            {form.id && <span className="text-xs text-gray-400">Salve antes para a pré-visualização mostrar as alterações.</span>}
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
          : posts.length === 0 ? <p className="p-12 text-center text-gray-400">Nenhum post ainda. Sugestões: “Como terminar o Ensino Médio online (EJA)”, “Pós EAD tem o mesmo valor da presencial?”, “Como consultar se um curso é reconhecido pelo MEC”.</p>
          : posts.map(p => (
            <div key={p.id} className="p-5 flex items-center gap-4">
              {statusOf(p) === 'publicado' ? <Eye size={18} className="text-green-500" /> : statusOf(p) === 'agendado' ? <CalendarClock size={18} className="text-amber-500" /> : <EyeOff size={18} className="text-gray-300" />}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900 truncate">{p.title}</p>
                <p className="text-xs text-gray-400 flex flex-wrap items-center gap-2">/blog/{p.slug}
                  <span className={`font-semibold px-2 py-0.5 rounded-full ${BADGE[statusOf(p)]}`}>
                    {statusOf(p) === 'agendado' ? `agendado · ${fmt(p.published_at)}` : statusOf(p) === 'publicado' ? `publicado · ${fmt(p.published_at)}` : 'rascunho'}
                  </span>
                </p>
              </div>
              <Link href={`/admin/blog/preview/${p.id}`} target="_blank" title="Ver como vai ficar" className="p-2 text-gray-400 hover:text-primary-600"><Monitor size={16} /></Link>
              {statusOf(p) === 'publicado' && <a href={`/blog/${p.slug}`} target="_blank" title="Abrir no site" className="p-2 text-gray-400 hover:text-primary-600"><ExternalLink size={16} /></a>}
              <button onClick={() => edit(p.id)} className="p-2 text-gray-400 hover:text-primary-600"><Edit size={16} /></button>
              <button onClick={() => remove(p.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
      </div>
    </div>
  )
}
