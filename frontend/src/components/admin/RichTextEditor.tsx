'use client'
import { useEffect, useRef, useState } from 'react'
import {
  Bold, Italic, Underline, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Link2, Unlink, Image, Undo2, Redo2, Loader2,
  Baseline, Highlighter, Search, X
} from 'lucide-react'
import api from '@/lib/api'
import { categoryHref, getCategoryInfo } from '@/lib/categories'

interface Props {
  value: string
  onChange: (val: string) => void
}

// ---------------------------------------------------------------------------
// Limpeza do conteúdo colado (Word, Google Docs, sites)
// Antes: o texto colado vinha com fonte, tamanho e cor do programa de origem
// (ex.: Arial 11pt cinza), fugindo do padrão do site. Agora só sobrevivem as
// tags de estrutura; a aparência é sempre a do site.
// ---------------------------------------------------------------------------
const ALLOWED = new Set(['P', 'BR', 'STRONG', 'EM', 'U', 'S', 'H2', 'H3', 'UL', 'OL', 'LI', 'A', 'IMG', 'BLOCKQUOTE', 'TABLE', 'THEAD', 'TBODY', 'TR', 'TH', 'TD'])
const RENAME: Record<string, string> = {
  B: 'strong', I: 'em', H1: 'h2', H4: 'h3', H5: 'h3', H6: 'h3',
  DIV: 'p', STRIKE: 's', DEL: 's', INS: 'u',
}
const KEEP_ATTR: Record<string, string[]> = { A: ['href', 'target', 'rel'], IMG: ['src', 'alt'] }

const isExternal = (url: string) => /^(https?:)?\/\//i.test(url) || url.startsWith('mailto:') || url.startsWith('tel:')

function cleanPastedHtml(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,meta,link,title,noscript,iframe,object,embed,input,button,svg').forEach(e => e.remove())

  const unwrap = (el: Element) => {
    const parent = el.parentNode
    if (!parent) return
    while (el.firstChild) parent.insertBefore(el.firstChild, el)
    parent.removeChild(el)
  }
  const rename = (el: Element, tag: string) => {
    const novo = doc.createElement(tag)
    while (el.firstChild) novo.appendChild(el.firstChild)
    el.replaceWith(novo)
  }

  for (let passo = 0; passo < 30; passo++) {
    const fora = Array.from(doc.body.querySelectorAll('*'))
      .filter(e => e.isConnected && (RENAME[e.tagName] || !ALLOWED.has(e.tagName)))
    if (!fora.length) break
    fora.forEach(e => {
      if (!e.isConnected) return
      // um <div> que contém parágrafos/listas é só um invólucro: some.
      // Um <div> com texto solto vira parágrafo.
      const temBloco = !!e.querySelector('p,h2,h3,h4,ul,ol,li,table,blockquote,div')
      if (RENAME[e.tagName] && !(e.tagName === 'DIV' && temBloco)) rename(e, RENAME[e.tagName])
      else unwrap(e)
    })
  }

  // Google Docs embrulha tudo num <b> falso: se negrito/itálico contém
  // parágrafos inteiros, ele é desfeito (senão sobra um <strong> vazio)
  for (let passo = 0; passo < 5; passo++) {
    const embrulhos = Array.from(doc.body.querySelectorAll('strong,em,u,s'))
      .filter(e => e.querySelector('p,h2,h3,ul,ol,li,table,blockquote'))
    if (!embrulhos.length) break
    embrulhos.forEach(unwrap)
  }

  // Tira estilo, classe e id de tudo (é isso que trazia a fonte do Word/Docs)
  doc.body.querySelectorAll('*').forEach(el => {
    const manter = KEEP_ATTR[el.tagName] || []
    Array.from(el.attributes).forEach(a => { if (!manter.includes(a.name)) el.removeAttribute(a.name) })
    if (el.tagName === 'A') {
      const href = el.getAttribute('href') || ''
      if (!href) { unwrap(el); return }
      if (isExternal(href)) { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer') }
      else { el.removeAttribute('target'); el.removeAttribute('rel') }
    }
    if (el.tagName === 'IMG') el.setAttribute('style', 'max-width:100%;height:auto;border-radius:8px;margin:8px 0;')
  })

  // Remove parágrafos que ficaram vazios
  doc.body.querySelectorAll('p,li,h2,h3,strong,em,u,s').forEach(el => {
    if (!el.textContent?.trim() && !el.querySelector('img')) el.remove()
  })

  return doc.body.innerHTML
}

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const textoParaParagrafos = (txt: string) =>
  txt.split(/\n{2,}/).map(bloco => `<p>${escapeHtml(bloco.trim()).replace(/\n/g, '<br>')}</p>`).join('')

// Páginas fixas do site que costumam virar link dentro de um artigo
const PAGINAS = [
  { label: 'Todos os cursos', href: '/cursos' },
  { label: 'Blog', href: '/blog' },
  { label: 'Como funciona', href: '/como-funciona' },
  { label: 'Reconhecimento MEC', href: '/reconhecimento-mec' },
  { label: 'Perguntas frequentes', href: '/perguntas-frequentes' },
  { label: 'Sobre nós', href: '/sobre-nos' },
]

interface CursoBusca { id: number; slug: string; title: string; category: string }

export default function RichTextEditor({ value, onChange }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const savedRange = useRef<Range | null>(null)

  // painel de link
  const [linkOpen, setLinkOpen] = useState(false)
  const [linkText, setLinkText] = useState('')
  const [linkUrl, setLinkUrl] = useState('')
  const [busca, setBusca] = useState('')
  const [resultados, setResultados] = useState<CursoBusca[]>([])
  const [buscando, setBuscando] = useState(false)
  const [categorias, setCategorias] = useState<{ label: string; href: string }[]>([])

  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '<p><br></p>'
      // Faz o Enter criar <p> em vez de <div> (era isso que deixava os
      // parágrafos colados, sem espaço entre eles, no artigo publicado)
      try { document.execCommand('defaultParagraphSeparator', false, 'p') } catch { /* navegador antigo */ }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // As categorias só são buscadas quando o painel de link abre (a tela de
  // conteúdo tem vários editores na mesma página; não faz sentido consultar
  // a API em todos eles ao carregar).
  useEffect(() => {
    if (!linkOpen || categorias.length) return
    api.get('/courses/categories')
      .then(r => setCategorias((r.data as { category: string }[]).map(c => ({ label: getCategoryInfo(c.category).label, href: categoryHref(c.category) }))))
      .catch(() => setCategorias([]))
  }, [linkOpen, categorias.length])

  // busca de cursos com atraso curto (o admin vai digitando)
  useEffect(() => {
    if (!linkOpen) return
    const termo = busca.trim()
    if (termo.length < 2) { setResultados([]); return }
    setBuscando(true)
    const t = setTimeout(() => {
      api.get('/search', { params: { q: termo, limit: 6 } })
        .then(r => setResultados(r.data.results || []))
        .catch(() => setResultados([]))
        .finally(() => setBuscando(false))
    }, 250)
    return () => clearTimeout(t)
  }, [busca, linkOpen])

  const emitir = () => {
    if (!ref.current) return
    const html = ref.current.innerHTML
    onChange(html === '<p><br></p>' ? '' : html)
  }

  const saveSelection = () => {
    const sel = window.getSelection()
    if (sel && sel.rangeCount > 0 && ref.current?.contains(sel.anchorNode)) {
      savedRange.current = sel.getRangeAt(0).cloneRange()
    }
  }

  const restoreSelection = () => {
    const sel = window.getSelection()
    if (sel && savedRange.current) {
      sel.removeAllRanges()
      sel.addRange(savedRange.current)
    }
  }

  const exec = (cmd: string, val?: string) => {
    ref.current?.focus()
    document.execCommand(cmd, false, val)
    emitir()
  }

  const execSaved = (fn: () => void) => {
    ref.current?.focus()
    restoreSelection()
    fn()
    emitir()
  }

  const applyColor = (cmd: string, color: string) => execSaved(() => {
    document.execCommand('styleWithCSS', false, 'true')
    document.execCommand(cmd, false, color)
    document.execCommand('styleWithCSS', false, 'false')
  })

  // ----- Link -----
  const abrirLink = () => {
    saveSelection()
    const sel = window.getSelection()
    const selecionado = sel && !sel.isCollapsed ? sel.toString().trim() : ''
    const aAtual = (sel?.anchorNode as HTMLElement | null)?.parentElement?.closest?.('a')
    setLinkText(selecionado || aAtual?.textContent?.trim() || '')
    setLinkUrl(aAtual?.getAttribute('href') || '')
    setBusca('')
    setResultados([])
    setLinkOpen(true)
  }

  const inserirLink = () => {
    const url = linkUrl.trim()
    const texto = (linkText.trim() || url)
    if (!url) return
    const externo = isExternal(url)
    const attrs = externo ? ' target="_blank" rel="noopener noreferrer"' : ''
    const html = `<a href="${escapeHtml(url)}"${attrs}>${escapeHtml(texto)}</a>`
    setLinkOpen(false)
    ref.current?.focus()
    restoreSelection()
    document.execCommand('insertHTML', false, html)
    emitir()
  }

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    setUploading(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const r = await api.post('/upload', fd, { headers: { 'Content-Type': 'multipart/form-data' } })
      ref.current?.focus()
      restoreSelection()
      exec('insertHTML', `<img src="${r.data.url}" alt="${escapeHtml(file.name)}" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`)
    } catch {
      window.alert('Erro ao enviar imagem. Tente colar a URL diretamente.')
    } finally {
      setUploading(false)
    }
  }

  const insertImageByUrl = () => {
    saveSelection()
    const url = window.prompt('URL da imagem:')
    if (!url) return
    restoreSelection()
    exec('insertHTML', `<img src="${escapeHtml(url)}" alt="" style="max-width:100%;height:auto;border-radius:8px;margin:8px 0;" />`)
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault()
    const html = e.clipboardData.getData('text/html')
    const texto = e.clipboardData.getData('text/plain')
    const limpo = html ? cleanPastedHtml(html) : textoParaParagrafos(texto)
    document.execCommand('insertHTML', false, limpo || escapeHtml(texto))
    emitir()
  }

  type BtnDef =
    | { type: 'cmd'; icon: React.ReactNode; title: string; cmd: string; val?: string }
    | { type: 'sep' }
    | { type: 'fn'; icon: React.ReactNode; title: string; fn: () => void }

  // "Título 1" saiu: o H1 da página já é o título do artigo (dois H1 atrapalham
  // o Google) e o site não tinha estilo para H1 dentro do texto.
  const STYLE_OPTIONS = [
    { label: 'Parágrafo', val: 'p' },
    { label: 'Título de seção', val: 'h2' },
    { label: 'Subtítulo', val: 'h3' },
  ]

  const FONT_FAMILIES = [
    { label: 'Fonte padrão', val: '' },
    { label: 'Arial', val: 'Arial, sans-serif' },
    { label: 'Georgia', val: 'Georgia, serif' },
    { label: 'Times New Roman', val: '"Times New Roman", serif' },
    { label: 'Courier New', val: '"Courier New", monospace' },
    { label: 'Verdana', val: 'Verdana, sans-serif' },
  ]

  const FONT_SIZES = [
    { label: 'Pequeno', val: '2' },
    { label: 'Normal', val: '3' },
    { label: 'Médio', val: '4' },
    { label: 'Grande', val: '5' },
    { label: 'Muito grande', val: '6' },
    { label: 'Enorme', val: '7' },
  ]

  const formatRow: BtnDef[] = [
    { type: 'cmd', icon: <Bold size={14} />, title: 'Negrito', cmd: 'bold' },
    { type: 'cmd', icon: <Italic size={14} />, title: 'Itálico', cmd: 'italic' },
    { type: 'cmd', icon: <Underline size={14} />, title: 'Sublinhado', cmd: 'underline' },
    { type: 'cmd', icon: <Strikethrough size={14} />, title: 'Tachado', cmd: 'strikeThrough' },
    { type: 'sep' },
    { type: 'cmd', icon: <AlignLeft size={14} />, title: 'Alinhar à esquerda', cmd: 'justifyLeft' },
    { type: 'cmd', icon: <AlignCenter size={14} />, title: 'Centralizar', cmd: 'justifyCenter' },
    { type: 'cmd', icon: <AlignRight size={14} />, title: 'Alinhar à direita', cmd: 'justifyRight' },
    { type: 'cmd', icon: <AlignJustify size={14} />, title: 'Justificar', cmd: 'justifyFull' },
    { type: 'sep' },
    { type: 'cmd', icon: <List size={14} />, title: 'Lista com marcadores', cmd: 'insertUnorderedList' },
    { type: 'cmd', icon: <ListOrdered size={14} />, title: 'Lista numerada', cmd: 'insertOrderedList' },
    { type: 'sep' },
    { type: 'fn', icon: <Link2 size={14} />, title: 'Inserir link (curso ou página)', fn: abrirLink },
    { type: 'cmd', icon: <Unlink size={14} />, title: 'Remover link', cmd: 'unlink' },
    { type: 'fn', icon: uploading ? <Loader2 size={14} className="animate-spin" /> : <Image size={14} />, title: 'Enviar imagem do computador', fn: () => { saveSelection(); fileRef.current?.click() } },
    { type: 'fn', icon: <span className="text-xs font-bold">URL</span>, title: 'Inserir imagem por URL', fn: insertImageByUrl },
  ]

  const selectClass = 'h-8 px-2 rounded border border-gray-200 bg-white text-sm text-gray-700 hover:border-gray-300 focus:outline-none'
  const btnClass = 'w-8 h-8 flex items-center justify-center rounded hover:bg-white hover:shadow-sm border border-transparent hover:border-gray-200 transition-all text-gray-700'

  const renderBtn = (item: BtnDef, i: number) => {
    if (item.type === 'sep') return <div key={i} className="w-px bg-gray-300 mx-1 self-stretch" />
    const handler = item.type === 'cmd'
      ? (e: React.MouseEvent) => { e.preventDefault(); exec(item.cmd, item.val) }
      : (e: React.MouseEvent) => { e.preventDefault(); item.fn() }
    return (
      <button key={i} type="button" title={item.title} onMouseDown={handler} className={btnClass}>
        {item.icon}
      </button>
    )
  }

  const escolher = (href: string, titulo?: string) => {
    setLinkUrl(href)
    if (!linkText.trim() && titulo) setLinkText(titulo)
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden relative">
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleImageUpload} />

      <div className="flex flex-wrap items-center gap-1 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <button type="button" title="Desfazer" onMouseDown={e => { e.preventDefault(); exec('undo') }} className={btnClass}><Undo2 size={14} /></button>
        <button type="button" title="Refazer" onMouseDown={e => { e.preventDefault(); exec('redo') }} className={btnClass}><Redo2 size={14} /></button>
        <div className="w-px bg-gray-300 mx-1 self-stretch" />
        <select title="Estilo do texto" defaultValue="p" onMouseDown={saveSelection}
          onChange={e => { const v = e.target.value; e.target.value = 'p'; execSaved(() => document.execCommand('formatBlock', false, v)) }}
          className={selectClass}>
          {STYLE_OPTIONS.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
        <select title="Fonte" defaultValue="" onMouseDown={saveSelection}
          onChange={e => { const v = e.target.value; e.target.value = ''; if (v) execSaved(() => document.execCommand('fontName', false, v)) }}
          className={selectClass}>
          {FONT_FAMILIES.map(o => <option key={o.label} value={o.val}>{o.label}</option>)}
        </select>
        <select title="Tamanho da fonte" defaultValue="3" onMouseDown={saveSelection}
          onChange={e => { const v = e.target.value; e.target.value = '3'; execSaved(() => document.execCommand('fontSize', false, v)) }}
          className={selectClass}>
          {FONT_SIZES.map(o => <option key={o.val} value={o.val}>{o.label}</option>)}
        </select>
      </div>

      <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        {formatRow.map(renderBtn)}
        <div className="w-px bg-gray-300 mx-1 self-stretch" />
        <label title="Cor do texto" onMouseDown={saveSelection}
          className={`relative cursor-pointer ${btnClass}`}>
          <Baseline size={14} />
          <input type="color" defaultValue="#000000" onChange={e => applyColor('foreColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
        <label title="Cor de destaque (marca-texto)" onMouseDown={saveSelection}
          className={`relative cursor-pointer ${btnClass}`}>
          <Highlighter size={14} />
          <input type="color" defaultValue="#ffff00" onChange={e => applyColor('hiliteColor', e.target.value)} className="absolute inset-0 opacity-0 cursor-pointer" />
        </label>
      </div>

      {/* Painel de link: busca o curso pelo nome em vez de digitar o endereço na mão */}
      {linkOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-[8vh]" onMouseDown={e => { if (e.target === e.currentTarget) setLinkOpen(false) }}>
        <div className="w-full max-w-lg bg-white rounded-xl shadow-2xl border border-gray-200 p-5 space-y-3 max-h-[80vh] overflow-auto">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm text-gray-900">Inserir link</p>
            <button type="button" onClick={() => setLinkOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Palavra ou frase que fica clicável</label>
            <input autoFocus className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm" value={linkText}
              onChange={e => setLinkText(e.target.value)} placeholder="Ex.: técnico em segurança do trabalho" />
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Buscar o curso pelo nome</label>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input className="w-full border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-sm" value={busca}
                onChange={e => setBusca(e.target.value)} placeholder="Digite: enfermagem, gestão escolar, EJA..." />
            </div>
            {buscando && <p className="text-xs text-gray-400 mt-1">Buscando...</p>}
            {resultados.length > 0 && (
              <div className="mt-2 border border-gray-100 rounded-lg divide-y divide-gray-50">
                {resultados.map(c => (
                  <button key={c.id} type="button" onClick={() => escolher(`/cursos/${c.slug}`, c.title)}
                    className={`w-full text-left px-3 py-2 hover:bg-primary-50 ${linkUrl === `/cursos/${c.slug}` ? 'bg-primary-50' : ''}`}>
                    <span className="block text-sm text-gray-800 truncate">{c.title}</span>
                    <span className="block text-[11px] text-gray-400">{c.category} · /cursos/{c.slug}</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs text-gray-500 mb-1">Ou uma página do site</p>
            <div className="flex flex-wrap gap-1.5">
              {[...categorias, ...PAGINAS].map(p => (
                <button key={p.href} type="button" onClick={() => escolher(p.href, p.label)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${linkUrl === p.href ? 'bg-primary-600 text-white border-primary-600' : 'border-gray-200 text-gray-600 hover:border-primary-300'}`}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs text-gray-500 mb-1">Destino (pode colar um endereço)</label>
            <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono" value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)} placeholder="/cursos/... ou https://..." />
            <p className="text-[11px] text-gray-400 mt-1">
              {linkUrl && isExternal(linkUrl) ? 'Link externo: abre em outra aba.' : 'Link do site: abre na mesma aba, sem perder o leitor.'}
            </p>
          </div>

          <div className="flex gap-2 pt-1">
            <button type="button" onClick={inserirLink} disabled={!linkUrl.trim()}
              className="btn-primary text-sm py-2 disabled:opacity-40">Inserir link</button>
            <button type="button" onClick={() => setLinkOpen(false)} className="text-sm text-gray-500 px-3">Cancelar</button>
          </div>
        </div>
        </div>
      )}

      <div
        ref={ref}
        contentEditable
        className="min-h-[220px] p-4 text-sm focus:outline-none prose-content"
        onInput={emitir}
        onPaste={handlePaste}
        onMouseUp={saveSelection}
        onKeyUp={saveSelection}
        suppressContentEditableWarning
      />
    </div>
  )
}
