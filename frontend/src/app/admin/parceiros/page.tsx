'use client'
// v2.4: cadastro de parceiros – instituições de ensino (IES) e empresas/convênios.
// Cada parceiro ativo ganha a página /parceiros/{endereço}; a lista fica em /parceiros
// (link no menu institucional: rodapé e menu do celular).
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Edit, Loader2, X, Save, ExternalLink, GraduationCap, Building2, Eye, EyeOff, AlertTriangle } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import ImageUpload from '@/components/admin/ImageUpload'
import RichTextEditor from '@/components/admin/RichTextEditor'
import { MENU_CATEGORY_NAMES, menuLabel } from '@/lib/categories'

type PType = 'ies' | 'empresa'
interface Partner {
  id?: number; type: PType; slug?: string; name: string; logo: string; cover_image: string; summary: string; content: string
  website: string; city: string; state: string
  emec_code: string; emec_url: string; accreditation: string; mec_score: string
  benefit: string; coupon_code: string; eligibility: string
  related_category: string; whatsapp_message: string
  featured: boolean; active: boolean; order_index: number | string
  seo_title: string; seo_description: string
  coupon_active?: boolean | null
}
const empty = (type: PType): Partner => ({
  type, slug: '', name: '', logo: '', cover_image: '', summary: '', content: '', website: '', city: '', state: '',
  emec_code: '', emec_url: '', accreditation: '', mec_score: '', benefit: '', coupon_code: '', eligibility: '',
  related_category: '', whatsapp_message: '', featured: false, active: true, order_index: 0, seo_title: '', seo_description: '',
})
const TYPE_LABEL: Record<PType, string> = { ies: 'Instituição de ensino (IES)', empresa: 'Empresa ou convênio' }

export default function ParceirosAdminPage() {
  const [list, setList] = useState<(Partner & { id: number; slug: string })[]>([])
  const [categories, setCategories] = useState<string[]>([])
  const [coupons, setCoupons] = useState<{ code: string; discount_percent: string; active: boolean }[]>([])
  const [loading, setLoading] = useState(true)
  const [form, setForm] = useState<Partner | null>(null)
  const [saving, setSaving] = useState(false)

  const load = () => Promise.all([
    api.get('/partners/admin/all').then(r => setList(r.data)),
    api.get('/courses/categories').then(r => setCategories([...new Set([...r.data.map((c: { category: string }) => c.category), ...MENU_CATEGORY_NAMES])] as string[])),
    api.get('/coupons').then(r => setCoupons(r.data)).catch(() => setCoupons([])),
  ]).finally(() => setLoading(false))
  useEffect(() => { load() }, [])

  const set = (k: keyof Partner, v: unknown) => setForm(f => f ? { ...f, [k]: v } : f)

  const save = async () => {
    if (!form?.name.trim()) { toast.error('Nome obrigatório'); return }
    setSaving(true)
    try {
      const r = form.id ? await api.put(`/partners/${form.id}`, form) : await api.post('/partners', form)
      toast.success(form.active ? 'Parceiro salvo e publicado' : 'Parceiro salvo (oculto no site)')
      setForm(f => f ? { ...f, id: r.data.id, slug: r.data.slug } : f)
      load()
    } catch (e) {
      toast.error((e as { response?: { data?: { error?: string } } }).response?.data?.error || 'Erro ao salvar')
    } finally { setSaving(false) }
  }

  const edit = async (id: number) => {
    const r = await api.get(`/partners/admin/${id}`)
    setForm({ ...empty(r.data.type), ...Object.fromEntries(Object.entries(r.data).map(([k, v]) => [k, v ?? ''])), featured: !!r.data.featured, active: !!r.data.active } as Partner)
    window.scrollTo({ top: 0 })
  }

  const remove = async (p: { id: number; name: string }) => {
    if (!confirm(`Remover o parceiro "${p.name}"? A página dele sai do site.`)) return
    await api.delete(`/partners/${p.id}`); toast.success('Removido'); load()
  }

  const couponInfo = form?.coupon_code ? coupons.find(c => c.code === form.coupon_code.trim().toUpperCase()) : undefined

  const section = (type: PType) => {
    const items = list.filter(p => p.type === type)
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="px-5 py-4 border-b border-gray-50 flex items-center gap-2 font-bold text-gray-900">
          {type === 'ies' ? <GraduationCap size={18} className="text-primary-600" /> : <Building2 size={18} className="text-primary-600" />}
          {type === 'ies' ? 'Instituições de ensino' : 'Empresas e convênios'} <span className="text-gray-400 font-normal">({items.length})</span>
        </div>
        {items.length === 0 ? <p className="p-6 text-sm text-gray-400">Nenhum cadastrado.</p> : (
          <ul className="divide-y divide-gray-50">
            {items.map(p => (
              <li key={p.id} className="p-4 flex items-center gap-4">
                {p.active ? <Eye size={18} className="text-green-500" /> : <EyeOff size={18} className="text-gray-300" />}
                <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden shrink-0 flex items-center justify-center">
                  {p.logo ? <img src={p.logo} alt="" className="w-full h-full object-contain p-1" /> : <span className="text-gray-300 text-xs">logo</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 truncate">{p.name}{p.featured ? <span className="ml-2 badge bg-yellow-100 text-yellow-800">destaque</span> : null}</p>
                  <p className="text-xs text-gray-400 truncate">/parceiros/{p.slug}{p.benefit ? ` · ${p.benefit}` : ''}{p.emec_code ? ` · e-MEC ${p.emec_code}` : ''}</p>
                  {p.coupon_code && p.coupon_active !== true && (
                    <p className="text-xs text-amber-700 flex items-center gap-1"><AlertTriangle size={12} /> Cupom {p.coupon_code} não existe ou está inativo em Cupons</p>
                  )}
                </div>
                {p.active && <a href={`/parceiros/${p.slug}`} target="_blank" title="Abrir no site" className="p-2 text-gray-400 hover:text-primary-600"><ExternalLink size={16} /></a>}
                <button onClick={() => edit(p.id)} className="p-2 text-gray-400 hover:text-primary-600" title="Editar"><Edit size={16} /></button>
                <button onClick={() => remove(p)} className="p-2 text-gray-400 hover:text-red-600" title="Remover"><Trash2 size={16} /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
    )
  }

  return (
    <div className="p-8 max-w-5xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Parceiros</h1>
          <p className="text-gray-500">Instituições de ensino e empresas/convênios. Cada parceiro ativo ganha uma página em <Link href="/parceiros" target="_blank" className="underline">/parceiros</Link>.</p>
        </div>
        {!form && (
          <div className="flex gap-2">
            <button onClick={() => setForm(empty('ies'))} className="btn-primary"><Plus size={18} /> Nova instituição</button>
            <button onClick={() => setForm(empty('empresa'))} className="btn-secondary"><Plus size={18} /> Nova empresa/convênio</button>
          </div>
        )}
      </div>

      {form && (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="font-bold">{form.id ? 'Editar' : 'Novo'} parceiro</h2>
            <button onClick={() => setForm(null)} className="text-gray-400" aria-label="Fechar"><X size={18} /></button>
          </div>

          <div className="flex flex-wrap gap-3">
            {(['ies', 'empresa'] as PType[]).map(t => (
              <label key={t} className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border-2 cursor-pointer text-sm font-medium ${form.type === t ? 'border-primary-600 bg-primary-50' : 'border-gray-200'}`}>
                <input type="radio" className="sr-only" checked={form.type === t} onChange={() => set('type', t)} />
                {t === 'ies' ? <GraduationCap size={16} /> : <Building2 size={16} />} {TYPE_LABEL[t]}
              </label>
            ))}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Nome *</label><input className="input" value={form.name} onChange={e => set('name', e.target.value)} placeholder={form.type === 'ies' ? 'Ex.: Centro Universitário UniCV' : 'Ex.: Sindicato dos Comerciários do DF'} /></div>
            <div><label className="label">Endereço da página (slug)</label><input className="input" value={form.slug} onChange={e => set('slug', e.target.value)} placeholder="gerado a partir do nome" /></div>
          </div>
          <div><label className="label">Resumo (aparece na lista e no Google)</label><textarea className="input" rows={2} value={form.summary} onChange={e => set('summary', e.target.value)} maxLength={600} /></div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ImageUpload value={form.logo} onChange={v => set('logo', v)} label="Logo (fundo claro, quadrado de preferência)" />
            <ImageUpload value={form.cover_image} onChange={v => set('cover_image', v)} label="Imagem de capa (opcional)" />
          </div>
          <div>
            <label className="label">Texto da página</label>
            <RichTextEditor value={form.content} onChange={v => set('content', v)} />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_90px] gap-4">
            <div><label className="label">Site oficial</label><input className="input" value={form.website} onChange={e => set('website', e.target.value)} placeholder="https://..." /></div>
            <div><label className="label">Cidade</label><input className="input" value={form.city} onChange={e => set('city', e.target.value)} /></div>
            <div><label className="label">UF</label><input className="input uppercase" maxLength={2} value={form.state} onChange={e => set('state', e.target.value.toUpperCase())} /></div>
          </div>

          {form.type === 'ies' ? (
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4 space-y-4">
              <p className="font-semibold text-gray-800 text-sm">Credenciamento no MEC</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div><label className="label">Código e-MEC</label><input className="input" value={form.emec_code} onChange={e => set('emec_code', e.target.value)} placeholder="Ex.: 3649" /></div>
                <div><label className="label">Conceito (CI/IGC)</label><input className="input" value={form.mec_score} onChange={e => set('mec_score', e.target.value)} placeholder="Ex.: CI 4" /></div>
                <div><label className="label">Link da consulta no e-MEC</label><input className="input" value={form.emec_url} onChange={e => set('emec_url', e.target.value)} placeholder="https://emec.mec.gov.br/..." /></div>
              </div>
              <div><label className="label">Atos de credenciamento (portaria e data)</label><textarea className="input" rows={2} value={form.accreditation} onChange={e => set('accreditation', e.target.value)} placeholder="Ex.: Credenciamento EAD: Portaria MEC nº 42, de 2023" /></div>
            </div>
          ) : (
            <div className="rounded-xl bg-green-50 border border-green-100 p-4 space-y-4">
              <p className="font-semibold text-gray-800 text-sm">Condição do convênio</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="label">Benefício (frase curta)</label><input className="input" value={form.benefit} onChange={e => set('benefit', e.target.value)} placeholder="Ex.: 15% de desconto em todos os cursos" /></div>
                <div>
                  <label className="label">Cupom do convênio (opcional)</label>
                  <input className="input uppercase" value={form.coupon_code} onChange={e => set('coupon_code', e.target.value.toUpperCase())} placeholder="Ex.: SINDICOM15" list="cupons" />
                  <datalist id="cupons">{coupons.filter(c => c.active).map(c => <option key={c.code} value={c.code}>{Number(c.discount_percent)}%</option>)}</datalist>
                  {form.coupon_code && (
                    couponInfo?.active
                      ? <p className="text-xs text-green-700 mt-1">Cupom ativo: {Number(couponInfo.discount_percent)}% de desconto. Aparece na página do parceiro.</p>
                      : <p className="text-xs text-amber-700 mt-1">Cupom não encontrado ou inativo. Crie em <Link href="/admin/cupons" className="underline">Cupons</Link>; enquanto isso, ele não aparece no site.</p>
                  )}
                </div>
              </div>
              <div><label className="label">Quem pode usar e como comprovar</label><textarea className="input" rows={2} value={form.eligibility} onChange={e => set('eligibility', e.target.value)} placeholder="Ex.: funcionários e dependentes, com contracheque ou carteirinha" /></div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="label">Cursos mostrados na página (categoria)</label>
              <select className="input" value={form.related_category} onChange={e => set('related_category', e.target.value)}>
                <option value="">Nenhum</option>
                {categories.map(c => <option key={c} value={c}>{menuLabel(c)}</option>)}
              </select>
            </div>
            <div><label className="label">Mensagem do WhatsApp (opcional)</label><input className="input" value={form.whatsapp_message} onChange={e => set('whatsapp_message', e.target.value)} placeholder={form.type === 'ies' ? 'Olá! Quero saber quais cursos ela certifica.' : 'Olá! Sou da empresa e quero usar o convênio.'} /></div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><label className="label">Título SEO (até 60 caracteres)</label><input className="input" value={form.seo_title} onChange={e => set('seo_title', e.target.value)} /><p className="text-xs text-gray-400 mt-1">{form.seo_title.length}/60</p></div>
            <div><label className="label">Descrição SEO (até 155 caracteres)</label><textarea className="input" rows={2} value={form.seo_description} onChange={e => set('seo_description', e.target.value)} /><p className="text-xs text-gray-400 mt-1">{form.seo_description.length}/155</p></div>
          </div>
          <div className="flex flex-wrap items-center gap-5 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.active} onChange={e => set('active', e.target.checked)} /> Mostrar no site</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={form.featured} onChange={e => set('featured', e.target.checked)} /> Destaque (aparece primeiro)</label>
            <label className="flex items-center gap-2">Ordem <input type="number" className="input !w-20 !py-1.5" value={form.order_index} onChange={e => set('order_index', e.target.value)} /></label>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-2 border-t border-gray-100">
            <button onClick={save} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
            {form.id && form.active && <a href={`/parceiros/${form.slug}`} target="_blank" className="text-sm font-semibold text-primary-700 hover:underline flex items-center gap-1"><ExternalLink size={14} /> Ver a página</a>}
          </div>
        </div>
      )}

      {loading ? <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div> : (
        <>
          {section('ies')}
          {section('empresa')}
        </>
      )}
    </div>
  )
}
