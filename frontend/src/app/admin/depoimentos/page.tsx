'use client'
// v2: cadastro de depoimentos (a API já existia, mas não havia tela no admin).
// Depoimentos aparecem na home, nas páginas de categoria e na página do curso.
import { useEffect, useState } from 'react'
import { Plus, Trash2, Edit, Loader2, X, Save, Star } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import ImageUpload from '@/components/admin/ImageUpload'
import type { Course, Testimonial } from '@/types'

type Form = { name: string; role: string; content: string; photo: string; course_id: string; active: boolean; order_index: number }
const empty: Form = { name: '', role: '', content: '', photo: '', course_id: '', active: true, order_index: 0 }

export default function DepoimentosPage() {
  const [items, setItems] = useState<Testimonial[]>([])
  const [courses, setCourses] = useState<Course[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Form | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => Promise.all([
    api.get('/content/testimonials/all').then(r => setItems(r.data)),
    api.get('/courses/all').then(r => setCourses(r.data)),
  ]).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const save = async () => {
    if (!form) return
    if (!form.name.trim() || !form.content.trim()) { toast.error('Nome e depoimento são obrigatórios'); return }
    setSaving(true)
    try {
      const body = { ...form, course_id: form.course_id ? Number(form.course_id) : null }
      if (editing) await api.put(`/content/testimonials/${editing}`, body)
      else await api.post('/content/testimonials', body)
      toast.success('Depoimento salvo')
      setForm(null); setEditing(null); load()
    } catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const remove = async (id: number) => {
    if (!confirm('Remover este depoimento?')) return
    await api.delete(`/content/testimonials/${id}`)
    toast.success('Removido'); load()
  }

  const courseTitle = (id?: number) => courses.find(c => c.id === id)?.title

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Depoimentos</h1>
          <p className="text-gray-500">Prova social exibida na home, nas categorias e nos cursos.</p>
        </div>
        <button onClick={() => { setForm(empty); setEditing(null) }} className="btn-primary"><Plus size={18} /> Novo depoimento</button>
      </div>
      <p className="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mb-6">
        Use apenas depoimentos reais, com autorização do aluno para uso do nome e da foto.
      </p>

      {form && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 mb-6 space-y-4">
          <div className="flex justify-between"><h2 className="font-bold">{editing ? 'Editar' : 'Novo'} depoimento</h2>
            <button onClick={() => setForm(null)} className="text-gray-400"><X size={18} /></button></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Nome do aluno *</label><input className="input" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></div>
            <div><label className="label">Profissão / cidade</label><input className="input" value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} placeholder="Enfermeira · Brasília/DF" /></div>
          </div>
          <div><label className="label">Depoimento *</label><textarea className="input" rows={4} value={form.content} onChange={e => setForm({ ...form, content: e.target.value })} /></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="label">Curso (opcional)</label>
              <select className="input" value={form.course_id} onChange={e => setForm({ ...form, course_id: e.target.value })}>
                <option value="">Depoimento geral</option>
                {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
              </select>
            </div>
            <div><label className="label">Ordem</label><input type="number" className="input" value={form.order_index} onChange={e => setForm({ ...form, order_index: Number(e.target.value) })} /></div>
          </div>
          <ImageUpload value={form.photo} onChange={v => setForm({ ...form, photo: v })} label="Foto (opcional)" />
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} /> Ativo (visível no site)</label>
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
        </div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 divide-y divide-gray-50">
        {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
          : items.length === 0 ? <p className="p-12 text-center text-gray-400">Nenhum depoimento cadastrado.</p>
          : items.map(t => (
            <div key={t.id} className="p-5 flex gap-4 items-start">
              <Star size={18} className={t.active ? 'text-yellow-400 fill-yellow-400' : 'text-gray-300'} />
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-gray-900">{t.name} <span className="font-normal text-gray-400 text-sm">{t.role}</span></p>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{t.content}</p>
                <p className="text-xs text-gray-400 mt-1">{courseTitle(t.course_id) || 'Geral'}{!t.active && ' · inativo'}</p>
              </div>
              <button onClick={() => { setEditing(t.id); setForm({ name: t.name, role: t.role || '', content: t.content, photo: t.photo || '', course_id: t.course_id ? String(t.course_id) : '', active: t.active, order_index: t.order_index || 0 }); window.scrollTo({ top: 0 }) }}
                className="p-2 text-gray-400 hover:text-primary-600"><Edit size={16} /></button>
              <button onClick={() => remove(t.id)} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={16} /></button>
            </div>
          ))}
      </div>
    </div>
  )
}
