'use client'
import { useEffect, useState } from 'react'
import { Save, Loader2, Plus, Trash2, ChevronDown, ChevronUp, Rocket, CheckCircle, School, Building2, HelpCircle, Link2, BarChart3, ListOrdered, ShieldCheck, FileText, LayoutGrid } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import ImageUpload from '@/components/admin/ImageUpload'
import RichTextEditor from '@/components/admin/RichTextEditor'

// v2: categorias com página própria (textos padrão ficam em src/lib/categories.ts; aqui é possível sobrescrever)
const CATEGORY_SLUGS = [
  { slug: 'eja', label: 'EJA' },
  { slug: 'tecnico', label: 'Técnico' },
  { slug: 'graduacao', label: 'Graduação (Bacharelado)' },
  { slug: 'tecnologo', label: 'Tecnólogo' },
  { slug: 'superior-sequencial', label: 'Superior Sequencial' },
  { slug: 'pos-graduacao', label: 'Pós-Graduação' },
]

interface BenefitItem { icon: string; text: string }
interface Stat { value: string; label: string }

const ICONS = ['award', 'monitor', 'clock', 'headphones', 'check', 'star', 'users', 'book']

export default function ConteudoPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [sections, setSections] = useState<Record<string, unknown>>({})
  const [expanded, setExpanded] = useState<string>('hero')
  const [catSlug, setCatSlug] = useState('eja')

  useEffect(() => {
    api.get('/content').then(r => setSections(r.data)).finally(() => setLoading(false))
  }, [])

  const save = async (key: string) => {
    setSaving(key)
    try {
      await api.put(`/content/${key}`, { data: sections[key] || {} })
      toast.success('Seção salva!')
    } catch { toast.error('Erro ao salvar') }
    finally { setSaving(null) }
  }

  const update = (key: string, data: unknown) => setSections(s => ({ ...s, [key]: data }))

  const getSection = (key: string): Record<string, unknown> => {
    return (sections[key] as Record<string, unknown>) || {}
  }

  const toggle = (key: string) => setExpanded(e => e === key ? '' : key)

  if (loading) return <div className="flex items-center justify-center h-64"><Loader2 size={32} className="animate-spin text-primary-500" /></div>

  const sectionCard = (key: string, icon: React.ReactNode, title: string, content: React.ReactNode, saveKey: string = key) => (
    <div key={key} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
      <div className="flex items-center justify-between p-5 cursor-pointer" onClick={() => toggle(key)}>
        <h2 className="font-bold text-gray-900 flex items-center gap-2">
          <span className="text-primary-600">{icon}</span> {title}
        </h2>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={e => { e.stopPropagation(); save(saveKey) }}
            disabled={saving === saveKey}
            className="btn-primary py-1.5 px-4 text-sm"
          >
            {saving === saveKey ? <Loader2 size={14} className="animate-spin" /> : <><Save size={14} /> Salvar</>}
          </button>
          {expanded === key ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </div>
      {expanded === key && <div className="px-5 pb-5 border-t border-gray-100 pt-4">{content}</div>}
    </div>
  )

  // Hero
  const hero = getSection('hero')
  // Benefits
  const benefits = getSection('benefits')
  const benefitItems = (benefits.items as BenefitItem[]) || []
  // About
  const about = getSection('about')
  const stats = (about.stats as Stat[]) || []
  // Footer
  const footer = getSection('footer')
  // Sobre Nós
  const sobreNos = getSection('sobre_nos')
  const sobreValues = (sobreNos.values as string[]) || []
  // FAQ Geral
  const faqGeral = getSection('faq_geral')
  const faqItems = (faqGeral.items as Array<{ question: string; answer: string }>) || []
  // v2
  const tracking = getSection('tracking')
  const comoFunciona = getSection('como_funciona')
  const cfSteps = (comoFunciona.steps as Array<{ title: string; text: string }>) || []
  const cfImages = (comoFunciona.images as string[]) || []
  const reconhecimento = getSection('reconhecimento')
  const recInst = (reconhecimento.institutions as Array<{ name: string; categories?: string; emec_url?: string; description?: string; logo?: string }>) || []
  const catData = getSection(`categoria_${catSlug}`)
  const catFaq = (catData.faq as Array<{ question: string; answer: string }>) || []

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Conteúdo do Site</h1>
        <p className="text-gray-500">Edite textos e imagens das seções principais</p>
      </div>

      {sectionCard('hero', <Rocket size={18} />, 'Hero – Seção Principal', (
        <div className="space-y-4">
          <div>
            <label className="label">Título Principal (headline)</label>
            <input value={String(hero.headline || '')} onChange={e => update('hero', { ...hero, headline: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Subtítulo</label>
            <textarea value={String(hero.subheadline || '')} onChange={e => update('hero', { ...hero, subheadline: e.target.value })} className="input" rows={2} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="label">Texto do Botão CTA</label>
              <input value={String(hero.cta_text || '')} onChange={e => update('hero', { ...hero, cta_text: e.target.value })} className="input" />
            </div>
            <div>
              <label className="label">Badge (ex: "5.000 alunos")</label>
              <input value={String(hero.badge_text || '')} onChange={e => update('hero', { ...hero, badge_text: e.target.value })} className="input" />
            </div>
          </div>
          <div>
            <label className="label">Provas exibidas abaixo da busca (uma por linha)</label>
            <textarea
              value={((hero.proof_items as string[]) || []).join('\n')}
              onChange={e => update('hero', { ...hero, proof_items: e.target.value.split('\n') })}
              className="input" rows={3}
              placeholder={'Polo oficial parceiro do Grupo LA Educação e do Grupo UNICORP\nCertificados com validade nacional\nAtendimento humano desde 2019'} />
            <p className="text-xs text-gray-400 mt-1">Deixe vazio para usar o texto padrão. Dica: título curto funciona melhor (até ~8 palavras).</p>
          </div>
          <ImageUpload value={String(hero.background_image || '')} onChange={v => update('hero', { ...hero, background_image: v })} label="Imagem de Fundo (opcional)" />
        </div>
      ))}

      {sectionCard('benefits', <CheckCircle size={18} />, 'Barra de Benefícios', (
        <div className="space-y-3">
          {benefitItems.map((item, i) => (
            <div key={i} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
              <select
                value={item.icon}
                onChange={e => {
                  const items = [...benefitItems]; items[i] = { ...items[i], icon: e.target.value }
                  update('benefits', { ...benefits, items })
                }}
                className="input w-32 text-xs"
              >
                {ICONS.map(ic => <option key={ic} value={ic}>{ic}</option>)}
              </select>
              <input
                value={item.text}
                onChange={e => {
                  const items = [...benefitItems]; items[i] = { ...items[i], text: e.target.value }
                  update('benefits', { ...benefits, items })
                }}
                className="input flex-1"
                placeholder="Benefício"
              />
              <button type="button" onClick={() => {
                const items = benefitItems.filter((_, idx) => idx !== i)
                update('benefits', { ...benefits, items })
              }} className="p-2 text-red-400 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <button type="button" onClick={() => update('benefits', { ...benefits, items: [...benefitItems, { icon: 'check', text: 'Novo benefício' }] })}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800">
            <Plus size={14} /> Adicionar benefício
          </button>
        </div>
      ))}

      {sectionCard('about', <School size={18} />, 'Sobre a Plataforma', (
        <div className="space-y-4">
          <div>
            <label className="label">Título</label>
            <input value={String(about.title || '')} onChange={e => update('about', { ...about, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Texto</label>
            <textarea value={String(about.text || '')} onChange={e => update('about', { ...about, text: e.target.value })} className="input" rows={4} />
          </div>
          <ImageUpload value={String(about.image || '')} onChange={v => update('about', { ...about, image: v })} label="Imagem" />
          <div>
            <label className="label">Estatísticas</label>
            <p className="text-xs text-gray-400 mb-2">Use <code>{'{total_cursos}'}</code> no valor para mostrar automaticamente o número de cursos ativos.</p>
            <div className="space-y-2">
              {stats.map((s, i) => (
                <div key={i} className="flex gap-3 items-center">
                  <input value={s.value} onChange={e => {
                    const ss = [...stats]; ss[i] = { ...ss[i], value: e.target.value }
                    update('about', { ...about, stats: ss })
                  }} className="input w-28" placeholder="5.000+" />
                  <input value={s.label} onChange={e => {
                    const ss = [...stats]; ss[i] = { ...ss[i], label: e.target.value }
                    update('about', { ...about, stats: ss })
                  }} className="input flex-1" placeholder="Alunos formados" />
                  <button type="button" onClick={() => update('about', { ...about, stats: stats.filter((_, idx) => idx !== i) })}
                          className="p-2 text-red-400 hover:text-red-600">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <button type="button" onClick={() => update('about', { ...about, stats: [...stats, { value: '', label: '' }] })}
                      className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800">
                <Plus size={14} /> Adicionar estatística
              </button>
            </div>
          </div>
        </div>
      ))}

      {sectionCard('sobre_nos', <Building2 size={18} />, 'Sobre Nós', (
        <div className="space-y-4">
          <div>
            <label className="label">Título da página</label>
            <input value={String(sobreNos.title || '')} onChange={e => update('sobre_nos', { ...sobreNos, title: e.target.value })} className="input" placeholder="Sobre a Academy Pop" />
          </div>
          <div>
            <label className="label">Missão</label>
            <textarea value={String(sobreNos.mission || '')} onChange={e => update('sobre_nos', { ...sobreNos, mission: e.target.value })} className="input" rows={3} placeholder="Nossa missão é..." />
          </div>
          <div>
            <label className="label">Visão</label>
            <textarea value={String(sobreNos.vision || '')} onChange={e => update('sobre_nos', { ...sobreNos, vision: e.target.value })} className="input" rows={2} placeholder="Nossa visão é..." />
          </div>
          <div>
            <label className="label">Valores (um por linha)</label>
            <textarea
              value={sobreValues.join('\n')}
              onChange={e => update('sobre_nos', { ...sobreNos, values: e.target.value.split('\n').filter(Boolean) })}
              className="input" rows={5} placeholder={'Excelência no ensino\nInovação\nRespeito ao aluno'} />
          </div>
          <div>
            <label className="label">História / Texto livre</label>
            <textarea value={String(sobreNos.history || '')} onChange={e => update('sobre_nos', { ...sobreNos, history: e.target.value })} className="input" rows={5} placeholder="A Academy Pop nasceu em..." />
          </div>
          <ImageUpload value={String(sobreNos.image || '')} onChange={v => update('sobre_nos', { ...sobreNos, image: v })} label="Foto / Imagem principal" />
        </div>
      ))}

      {sectionCard('faq_geral', <HelpCircle size={18} />, 'Perguntas Frequentes Gerais', (
        <div className="space-y-3">
          {faqItems.map((item, i) => (
            <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-primary-600">Pergunta {i + 1}</span>
                <button type="button" onClick={() => {
                  const items = faqItems.filter((_, idx) => idx !== i)
                  update('faq_geral', { ...faqGeral, items })
                }} className="p-1 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
              </div>
              <input value={item.question} onChange={e => {
                const items = [...faqItems]; items[i] = { ...items[i], question: e.target.value }
                update('faq_geral', { ...faqGeral, items })
              }} className="input" placeholder="Pergunta..." />
              <textarea value={item.answer} onChange={e => {
                const items = [...faqItems]; items[i] = { ...items[i], answer: e.target.value }
                update('faq_geral', { ...faqGeral, items })
              }} className="input" rows={2} placeholder="Resposta..." />
            </div>
          ))}
          <button type="button" onClick={() => update('faq_geral', { ...faqGeral, items: [...faqItems, { question: '', answer: '' }] })}
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800">
            <Plus size={14} /> Adicionar pergunta
          </button>
        </div>
      ))}


      {/* ===================== v2 ===================== */}
      {sectionCard('tracking', <BarChart3 size={18} />, 'Rastreamento (Google Analytics 4 e Meta Pixel)', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">ID do GA4 (G-XXXXXXX)</label>
            <input value={String(tracking.ga4_id || '')} onChange={e => update('tracking', { ...tracking, ga4_id: e.target.value.trim() })} className="input" placeholder="G-ABC123XYZ" />
          </div>
          <div>
            <label className="label">ID do Meta Pixel (só números)</label>
            <input value={String(tracking.meta_pixel_id || '')} onChange={e => update('tracking', { ...tracking, meta_pixel_id: e.target.value.trim() })} className="input" placeholder="123456789012345" />
          </div>
          <p className="md:col-span-2 text-xs text-gray-400">Eventos enviados: view_item, add_to_cart, begin_checkout, purchase, search, select_item e whatsapp_click. Leva até 5 minutos para valer no site.</p>
        </div>
      ))}

      {sectionCard('como_funciona', <ListOrdered size={18} />, 'Página Como Funciona', (
        <div className="space-y-4">
          <div>
            <label className="label">Título</label>
            <input value={String(comoFunciona.title || '')} onChange={e => update('como_funciona', { ...comoFunciona, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Introdução</label>
            <textarea value={String(comoFunciona.intro || '')} onChange={e => update('como_funciona', { ...comoFunciona, intro: e.target.value })} className="input" rows={2} />
          </div>
          <div>
            <label className="label">Etapas (aparecem também na home)</label>
            <div className="space-y-2">
              {cfSteps.map((st, i) => (
                <div key={i} className="flex gap-2 items-start">
                  <span className="w-7 h-9 flex items-center justify-center text-sm font-bold text-primary-600">{i + 1}</span>
                  <div className="flex-1 space-y-1">
                    <input value={st.title} onChange={e => { const ss = [...cfSteps]; ss[i] = { ...ss[i], title: e.target.value }; update('como_funciona', { ...comoFunciona, steps: ss }) }} className="input" placeholder="Título da etapa" />
                    <textarea value={st.text} onChange={e => { const ss = [...cfSteps]; ss[i] = { ...ss[i], text: e.target.value }; update('como_funciona', { ...comoFunciona, steps: ss }) }} className="input" rows={2} placeholder="Descrição" />
                  </div>
                  <button type="button" onClick={() => update('como_funciona', { ...comoFunciona, steps: cfSteps.filter((_, x) => x !== i) })} className="p-2 text-red-400 hover:text-red-600"><Trash2 size={16} /></button>
                </div>
              ))}
              <button type="button" onClick={() => update('como_funciona', { ...comoFunciona, steps: [...cfSteps, { title: '', text: '' }] })} className="flex items-center gap-2 text-sm text-primary-600"><Plus size={14} /> Adicionar etapa</button>
            </div>
          </div>
          <div>
            <label className="label">Vídeo da plataforma (link do YouTube, opcional)</label>
            <input value={String(comoFunciona.video_url || '')} onChange={e => update('como_funciona', { ...comoFunciona, video_url: e.target.value })} className="input" placeholder="https://www.youtube.com/watch?v=..." />
          </div>
          <div>
            <label className="label">Prints da plataforma (opcional)</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[0, 1, 2, 3].map(i => (
                <ImageUpload key={i} value={cfImages[i] || ''} label={`Imagem ${i + 1}`}
                  onChange={v => { const im = [...cfImages]; im[i] = v; update('como_funciona', { ...comoFunciona, images: im }) }} />
              ))}
            </div>
          </div>
        </div>
      ))}

      {sectionCard('reconhecimento', <ShieldCheck size={18} />, 'Página Reconhecimento MEC', (
        <div className="space-y-4">
          <div>
            <label className="label">Título</label>
            <input value={String(reconhecimento.title || '')} onChange={e => update('reconhecimento', { ...reconhecimento, title: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Introdução</label>
            <textarea value={String(reconhecimento.intro || '')} onChange={e => update('reconhecimento', { ...reconhecimento, intro: e.target.value })} className="input" rows={3} />
          </div>
          <div>
            <label className="label">Instituições certificadoras</label>
            <div className="space-y-3">
              {recInst.map((inst, i) => (
                <div key={i} className="border border-gray-200 rounded-xl p-4 space-y-2">
                  <div className="flex justify-between"><span className="text-xs font-semibold text-primary-600">Instituição {i + 1}</span>
                    <button type="button" onClick={() => update('reconhecimento', { ...reconhecimento, institutions: recInst.filter((_, x) => x !== i) })} className="text-red-400 hover:text-red-600"><Trash2 size={16} /></button></div>
                  {(['name', 'categories', 'emec_url', 'description'] as const).map(f => (
                    <input key={f} value={inst[f] || ''} onChange={e => { const ii = [...recInst]; ii[i] = { ...ii[i], [f]: e.target.value }; update('reconhecimento', { ...reconhecimento, institutions: ii }) }}
                      className="input" placeholder={{ name: 'Nome da instituição', categories: 'O que certifica (ex.: Pós-Graduação e Técnico)', emec_url: 'Link da página da instituição no e-MEC', description: 'Descrição curta (opcional)' }[f]} />
                  ))}
                  <ImageUpload value={inst.logo || ''} label="Logo (opcional)" onChange={v => { const ii = [...recInst]; ii[i] = { ...ii[i], logo: v }; update('reconhecimento', { ...reconhecimento, institutions: ii }) }} />
                </div>
              ))}
              <button type="button" onClick={() => update('reconhecimento', { ...reconhecimento, institutions: [...recInst, { name: '' }] })} className="flex items-center gap-2 text-sm text-primary-600"><Plus size={14} /> Adicionar instituição</button>
            </div>
          </div>
          <div>
            <label className="label">Como verificar (um passo por linha)</label>
            <textarea value={((reconhecimento.how_to_verify as string[]) || []).join('\n')} onChange={e => update('reconhecimento', { ...reconhecimento, how_to_verify: e.target.value.split('\n') })} className="input" rows={4} />
          </div>
          <ImageUpload value={String(reconhecimento.diploma_image || '')} onChange={v => update('reconhecimento', { ...reconhecimento, diploma_image: v })} label="Modelo de certificado/diploma (opcional)" />
        </div>
      ))}

      {sectionCard('categorias', <LayoutGrid size={18} />, 'Páginas de Categoria (textos)', (
        <div className="space-y-4">
          <div>
            <label className="label">Categoria</label>
            <select value={catSlug} onChange={e => setCatSlug(e.target.value)} className="input">
              {CATEGORY_SLUGS.map(c => <option key={c.slug} value={c.slug}>{c.label} (/{c.slug})</option>)}
            </select>
            <p className="text-xs text-gray-400 mt-1">Campos vazios usam o texto padrão. Clique em Salvar para gravar a categoria selecionada.</p>
          </div>
          {(['headline', 'intro', 'seo_title', 'seo_description'] as const).map(f => (
            <div key={f}>
              <label className="label">{{ headline: 'Título (H1)', intro: 'Texto de abertura', seo_title: 'Título para o Google (até 60 caracteres)', seo_description: 'Descrição para o Google (até 155 caracteres)' }[f]}</label>
              {f === 'intro' || f === 'seo_description'
                ? <textarea value={String(catData[f] || '')} onChange={e => update(`categoria_${catSlug}`, { ...catData, [f]: e.target.value })} className="input" rows={3} />
                : <input value={String(catData[f] || '')} onChange={e => update(`categoria_${catSlug}`, { ...catData, [f]: e.target.value })} className="input" />}
            </div>
          ))}
          <div>
            <label className="label">Perguntas frequentes da categoria</label>
            {catFaq.map((fq, i) => (
              <div key={i} className="border border-gray-200 rounded-xl p-3 mb-2 space-y-2">
                <div className="flex gap-2">
                  <input value={fq.question} onChange={e => { const ff = [...catFaq]; ff[i] = { ...ff[i], question: e.target.value }; update(`categoria_${catSlug}`, { ...catData, faq: ff }) }} className="input" placeholder="Pergunta" />
                  <button type="button" onClick={() => update(`categoria_${catSlug}`, { ...catData, faq: catFaq.filter((_, x) => x !== i) })} className="text-red-400 hover:text-red-600 px-2"><Trash2 size={16} /></button>
                </div>
                <textarea value={fq.answer} onChange={e => { const ff = [...catFaq]; ff[i] = { ...ff[i], answer: e.target.value }; update(`categoria_${catSlug}`, { ...catData, faq: ff }) }} className="input" rows={2} placeholder="Resposta" />
              </div>
            ))}
            <button type="button" onClick={() => update(`categoria_${catSlug}`, { ...catData, faq: [...catFaq, { question: '', answer: '' }] })} className="flex items-center gap-2 text-sm text-primary-600"><Plus size={14} /> Adicionar pergunta</button>
          </div>
        </div>
      ), `categoria_${catSlug}`)}

      {(['privacidade', 'termos'] as const).map(key => {
        const d = getSection(key)
        return sectionCard(key, <FileText size={18} />, key === 'privacidade' ? 'Política de Privacidade' : 'Termos de Uso', (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="label">Título</label>
                <input value={String(d.title || '')} onChange={e => update(key, { ...d, title: e.target.value })} className="input" />
              </div>
              <div>
                <label className="label">Atualizado em</label>
                <input type="date" value={String(d.updated_at || '')} onChange={e => update(key, { ...d, updated_at: e.target.value })} className="input" />
              </div>
            </div>
            <RichTextEditor value={String(d.html || '')} onChange={v => update(key, { ...d, html: v })} />
            <p className="text-xs text-amber-600">Texto-base gerado automaticamente. Recomendamos revisão por um advogado.</p>
          </div>
        ))
      })}

      {sectionCard('footer', <Link2 size={18} />, 'Rodapé e Contato', (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Nome da Empresa</label>
            <input value={String(footer.company_name || '')} onChange={e => update('footer', { ...footer, company_name: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">WhatsApp (com DDI, ex: 5511999999999)</label>
            <input value={String(footer.whatsapp || '')} onChange={e => update('footer', { ...footer, whatsapp: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">E-mail de contato</label>
            <input value={String(footer.email || '')} onChange={e => update('footer', { ...footer, email: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Endereço (opcional)</label>
            <input value={String(footer.address || '')} onChange={e => update('footer', { ...footer, address: e.target.value })} className="input" />
          </div>
          <div>
            <label className="label">Instagram</label>
            <input value={String(footer.instagram || '')} onChange={e => update('footer', { ...footer, instagram: e.target.value })} className="input" placeholder="https://instagram.com/..." />
          </div>
          <div>
            <label className="label">Facebook</label>
            <input value={String(footer.facebook || '')} onChange={e => update('footer', { ...footer, facebook: e.target.value })} className="input" placeholder="https://facebook.com/..." />
          </div>
          <div>
            <label className="label">YouTube</label>
            <input value={String(footer.youtube || '')} onChange={e => update('footer', { ...footer, youtube: e.target.value })} className="input" placeholder="https://youtube.com/@..." />
          </div>
          <div>
            <label className="label">CNPJ (aparece no rodapé)</label>
            <input value={String(footer.cnpj || '')} onChange={e => update('footer', { ...footer, cnpj: e.target.value })} className="input" placeholder="00.000.000/0001-00" />
          </div>
          <div className="md:col-span-2">
            <label className="label">Descrição</label>
            <textarea value={String(footer.description || '')} onChange={e => update('footer', { ...footer, description: e.target.value })} className="input" rows={2} />
          </div>
        </div>
      ))}
    </div>
  )
}
