'use client'
// Busca instantânea de cursos.
// - resultados a partir da 2ª letra, refinando a cada tecla (espera 150 ms e cancela a busca anterior)
// - procura no nome, no tipo (categoria + sinônimos) e no conteúdo (disciplinas, descrição)
// - tolera erro de digitação e falta de acento; sugere "Você quis dizer"
// - filtros rápidos por tipo com contagem, navegação por teclado, versão tela cheia no celular
// - sem resultado: botão de WhatsApp com o termo buscado
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Search, X, Loader2, ArrowRight, MessageCircle, Clock, TrendingUp, BookOpen } from 'lucide-react'
import { track } from '@/lib/analytics'
import { brl, whatsappLink } from '@/lib/site'
import { getCategoryInfo } from '@/lib/categories'

interface Result {
  id: number
  slug: string
  title: string
  category: string
  cover_image?: string
  workload?: number
  duration?: string
  price_pix?: string | number
  reason?: { type: string; text: string | null } | null
}
interface Resp {
  total: number
  total_all_categories: number
  facets: Record<string, number>
  suggestion: string | null
  results: Result[]
}

const strip = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const RECENT_KEY = 'academypop_recent_v1'

export function readRecent(): { slug: string; title: string }[] {
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) || '[]').slice(0, 5) } catch { return [] }
}
export function pushRecent(item: { slug: string; title: string }) {
  try {
    const list = readRecent().filter(i => i.slug !== item.slug)
    localStorage.setItem(RECENT_KEY, JSON.stringify([item, ...list].slice(0, 5)))
  } catch { /* ignore */ }
}

// Destaca os termos no texto, ignorando acentos e maiúsculas
function Highlight({ text, query }: { text: string; query: string }) {
  const tokens = strip(query).split(/[^a-z0-9]+/).filter(t => t.length >= 2)
  if (!tokens.length) return <>{text}</>
  const norm = Array.from(text).map(c => strip(c).charAt(0) || c).join('')
  const marks = new Array(text.length).fill(false)
  for (const t of tokens) {
    let i = norm.indexOf(t)
    while (i !== -1) { for (let k = i; k < i + t.length; k++) marks[k] = true; i = norm.indexOf(t, i + t.length) }
  }
  const out: React.ReactNode[] = []
  let buf = ''
  let cur = marks[0]
  Array.from(text).forEach((ch, i) => {
    if (marks[i] !== cur) { out.push(cur ? <mark key={i} className="bg-transparent font-bold text-primary-900">{buf}</mark> : buf); buf = ''; cur = marks[i] }
    buf += ch
  })
  out.push(cur ? <mark key="end" className="bg-transparent font-bold text-primary-900">{buf}</mark> : buf)
  return <>{out}</>
}

interface Props {
  variant?: 'hero' | 'header' | 'page'
  initialQuery?: string
  categories?: { category: string; count: number }[]
  whatsapp?: string
  placeholder?: string
  autoFocus?: boolean
  onNavigate?: () => void
}

export default function SearchBox({ variant = 'hero', initialQuery = '', categories = [], whatsapp, placeholder, autoFocus, onNavigate }: Props) {
  const router = useRouter()
  const listId = useId()
  const [q, setQ] = useState(initialQuery)
  const [cat, setCat] = useState('')
  const [data, setData] = useState<Resp | null>(null)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(-1)
  const [popular, setPopular] = useState<string[]>([])
  const [recent, setRecent] = useState<{ slug: string; title: string }[]>([])
  const abortRef = useRef<AbortController | null>(null)
  const loggedRef = useRef<string>('')
  const boxRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const term = q.trim()
  const searching = term.length >= 2

  // Busca com debounce de 150 ms e cancelamento da anterior
  useEffect(() => {
    if (!searching) { setData(null); setLoading(false); return }
    setLoading(true)
    const t = setTimeout(async () => {
      abortRef.current?.abort()
      const ctrl = new AbortController()
      abortRef.current = ctrl
      try {
        const params = new URLSearchParams({ q: term, limit: '8' })
        if (cat) params.set('categoria', cat)
        const res = await fetch(`/api/search?${params}`, { signal: ctrl.signal })
        const json: Resp = await res.json()
        setData(json)
        setActive(-1)
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setData(null)
      } finally {
        if (!ctrl.signal.aborted) setLoading(false)
      }
    }, 150)
    return () => clearTimeout(t)
  }, [term, cat, searching])

  // Registra o termo quando o cliente para de digitar (relatório no admin)
  useEffect(() => {
    if (!data || term.length < 3) return
    const t = setTimeout(() => {
      const key = `${strip(term)}|${cat}`
      if (loggedRef.current === key) return
      loggedRef.current = key
      fetch('/api/search/log', {
        method: 'POST', headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ term, results: data.total, category: cat || undefined }),
      }).catch(() => {})
      track('search', { search_term: term })
    }, 1200)
    return () => clearTimeout(t)
  }, [data, term, cat])

  // Sugestões com o campo vazio
  useEffect(() => {
    if (!open || popular.length || searching) return
    fetch('/api/search/popular').then(r => r.json()).then(setPopular).catch(() => {})
    setRecent(readRecent())
  }, [open, popular.length, searching])

  // Fecha ao clicar fora
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const results = data?.results || []
  const facetList = useMemo(() => {
    if (searching && data) {
      return Object.entries(data.facets).map(([category, count]) => ({ category, count }))
        .sort((a, b) => getCategoryInfo(a.category).order - getCategoryInfo(b.category).order)
    }
    return categories
  }, [searching, data, categories])

  const goAll = useCallback(() => {
    const params = new URLSearchParams()
    if (term) params.set('q', term)
    if (cat) params.set('categoria', cat)
    setOpen(false)
    onNavigate?.()
    router.push(`/cursos${params.toString() ? `?${params}` : ''}`)
  }, [term, cat, router, onNavigate])

  const choose = useCallback((r: Result, index: number) => {
    track('select_item', { item_list_name: 'busca', search_term: term, items: [{ item_id: String(r.id), item_name: r.title, index }] })
    setOpen(false)
    onNavigate?.()
    router.push(`/cursos/${r.slug}`)
  }, [router, term, onNavigate])

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive(a => Math.min(a + 1, results.length)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(a => Math.max(a - 1, -1)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (active >= 0 && active < results.length) choose(results[active], active)
      else goAll()
    } else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  const big = variant === 'hero'
  const showPanel = open && (searching || popular.length > 0 || recent.length > 0 || categories.length > 0)

  return (
    <div ref={boxRef} className="relative w-full">
      <div className={`flex items-center gap-2 bg-white rounded-xl shadow-lg ring-1 ring-black/5 focus-within:ring-2 focus-within:ring-accent-500 ${big ? 'px-4 py-3 md:py-4' : 'px-3 py-2.5'}`}>
        <Search size={big ? 22 : 18} className="text-gray-400 shrink-0" aria-hidden />
        <input
          ref={inputRef}
          type="search"
          value={q}
          autoFocus={autoFocus}
          onChange={e => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKey}
          placeholder={placeholder || 'Busque por curso, área ou disciplina'}
          className={`flex-1 min-w-0 bg-transparent outline-none text-gray-900 placeholder:text-gray-400 ${big ? 'text-base md:text-lg' : 'text-sm'}`}
          role="combobox"
          aria-expanded={showPanel}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
          aria-label="Buscar cursos"
          enterKeyHint="search"
        />
        {loading && <Loader2 size={18} className="animate-spin text-gray-400 shrink-0" aria-hidden />}
        {q && !loading && (
          <button type="button" onClick={() => { setQ(''); setCat(''); inputRef.current?.focus() }} className="p-1 text-gray-400 hover:text-gray-600" aria-label="Limpar busca">
            <X size={18} />
          </button>
        )}
        {big && (
          <button type="button" onClick={goAll} className="hidden sm:inline-flex btn-primary py-2.5 px-5 text-sm shadow-none">
            Buscar
          </button>
        )}
      </div>

      {showPanel && (
        <div className={`${variant === 'page' ? 'absolute' : 'absolute'} left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl ring-1 ring-black/5 z-50 overflow-hidden text-left`}>
          {/* Filtros rápidos por tipo */}
          {facetList.length > 0 && (
            <div className="flex gap-2 overflow-x-auto px-3 py-3 border-b border-gray-100 [scrollbar-width:none]">
              <button type="button" onClick={() => setCat('')}
                className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${!cat ? 'bg-primary-900 text-white border-primary-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                Todos{searching && data ? ` (${data.total_all_categories})` : ''}
              </button>
              {facetList.map(f => (
                <button key={f.category} type="button" onClick={() => { setCat(cat === f.category ? '' : f.category); inputRef.current?.focus() }}
                  className={`shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full border transition ${cat === f.category ? 'bg-primary-900 text-white border-primary-900' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {getCategoryInfo(f.category).label} ({f.count})
                </button>
              ))}
            </div>
          )}

          {!searching && (
            <div className="p-3 space-y-3">
              {recent.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-1 mb-1">Vistos recentemente</p>
                  {recent.map(r => (
                    <Link key={r.slug} href={`/cursos/${r.slug}`} onClick={() => { setOpen(false); onNavigate?.() }}
                      className="flex items-center gap-2 px-2 py-2 rounded-lg text-sm text-gray-700 hover:bg-gray-50">
                      <Clock size={14} className="text-gray-400" /> {r.title}
                    </Link>
                  ))}
                </div>
              )}
              {popular.length > 0 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wide text-gray-400 font-semibold px-1 mb-1">Mais buscados</p>
                  <div className="flex flex-wrap gap-2 px-1">
                    {popular.map(p => (
                      <button key={p} type="button" onClick={() => { setQ(p); inputRef.current?.focus() }}
                        className="inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-full bg-gray-100 text-gray-700 hover:bg-gray-200">
                        <TrendingUp size={12} /> {p}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {!recent.length && !popular.length && (
                <p className="text-sm text-gray-500 px-1 py-2">Digite o nome do curso, a área (ex.: saúde, gestão) ou uma disciplina.</p>
              )}
            </div>
          )}

          {searching && (
            <>
              {data?.suggestion && (
                <p className="px-4 pt-3 text-sm text-gray-600">
                  Você quis dizer{' '}
                  <button type="button" onClick={() => setQ(data.suggestion || '')} className="font-semibold text-accent-700 underline underline-offset-2">
                    {data.suggestion}
                  </button>?
                </p>
              )}

              <ul id={listId} role="listbox" className="max-h-[60vh] overflow-y-auto py-2">
                {results.map((r, i) => (
                  <li key={r.id} id={`${listId}-${i}`} role="option" aria-selected={active === i}>
                    <button type="button" onMouseEnter={() => setActive(i)} onClick={() => choose(r, i)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left ${active === i ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                      <div className="w-14 h-10 rounded-md bg-gradient-to-br from-primary-800 to-primary-900 overflow-hidden shrink-0">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        {r.cover_image && <img src={r.cover_image} alt="" loading="lazy" className="w-full h-full object-cover" />}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-gray-800 leading-snug line-clamp-2"><Highlight text={r.title} query={term} /></p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {getCategoryInfo(r.category).label}
                          {r.workload ? ` · ${r.workload}h` : ''}
                          {Number(r.price_pix) > 0 ? ` · ${brl(r.price_pix)}` : ''}
                        </p>
                        {r.reason?.type === 'disciplina' && r.reason.text && (
                          <p className="text-xs text-accent-700 mt-0.5 flex items-center gap-1">
                            <BookOpen size={11} /> contém a disciplina <Highlight text={r.reason.text} query={term} />
                          </p>
                        )}
                        {r.reason?.type === 'conteudo' && (
                          <p className="text-xs text-gray-400 mt-0.5">termo encontrado na descrição do curso</p>
                        )}
                      </div>
                    </button>
                  </li>
                ))}
              </ul>

              {data && data.total > results.length && (
                <button type="button" onClick={goAll} onMouseEnter={() => setActive(results.length)}
                  className={`w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-accent-700 border-t border-gray-100 ${active === results.length ? 'bg-primary-50' : 'hover:bg-gray-50'}`}>
                  Ver todos os {data.total} resultados <ArrowRight size={16} />
                </button>
              )}

              {data && data.total === 0 && !loading && (
                <div className="px-4 py-5 text-center">
                  <p className="text-sm text-gray-700 font-medium">Nenhum curso encontrado para “{term}”.</p>
                  <p className="text-xs text-gray-500 mt-1 mb-4">Temos cursos que não estão no site. Pergunte a um consultor:</p>
                  <a href={whatsappLink(whatsapp, `Olá! Procurei por "${term}" no site e não encontrei. Vocês têm esse curso?`)}
                    target="_blank" rel="noopener noreferrer"
                    onClick={() => track('whatsapp_click', { location: 'busca_sem_resultado', search_term: term })}
                    className="inline-flex items-center gap-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold px-4 py-2.5 rounded-lg">
                    <MessageCircle size={16} /> Perguntar no WhatsApp
                  </a>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
