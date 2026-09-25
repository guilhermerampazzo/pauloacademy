'use client'
// v2.4: Pagamentos TMB – parcelado sem cartão (PIX ou boleto) no checkout do site
import { Fragment, useEffect, useState } from 'react'
import { Save, Loader2, CheckCircle, AlertTriangle, Copy, RefreshCw, ExternalLink } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { MENU_CATEGORY_NAMES, menuLabel } from '@/lib/categories'
import { tmbSimulate, nx } from '@/lib/pricing'

interface CatCfg { active: boolean; produto_id: number | string | null; qtd_parcelas: number | string | null; link_manual: string | null; link_manual_valor: number | string | null
  juros_mes?: number | string | null; entrada_tipo?: 'percentual' | 'valor'; entrada_valor?: number | string | null; parcela_minima?: number | string | null }
interface Config { enabled: boolean; categories: Record<string, CatCfg> }
interface Status { api_token: boolean; webhook_token: boolean; webhook_url: string; webhook_header: string; ga4_api_secret: boolean; min_value: number }
interface Offer { id: number; category: string; produto_id: number; valor: string; qtd_parcelas: number; titulo: string; url: string; active: boolean; created_at: string }
interface Evt { id: number; order_id: number | null; tmb_order_id: number | null; status_pedido: string | null; fase_checkout: string | null; created_at: string }
interface Produto { produto_id: number; produto_nome: string; valor_total?: string; ativo?: boolean }

const emptyCat: CatCfg = { active: false, produto_id: '', qtd_parcelas: '', link_manual: '', link_manual_valor: '', juros_mes: 3.49, entrada_tipo: 'percentual', entrada_valor: 10, parcela_minima: 3 }

export default function TmbAdminPage() {
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [config, setConfig] = useState<Config>({ enabled: false, categories: {} })
  const [status, setStatus] = useState<Status | null>(null)
  const [offers, setOffers] = useState<Offer[]>([])
  const [events, setEvents] = useState<Evt[]>([])
  const [dbCats, setDbCats] = useState<{ category: string; count: number; min_price: string | null }[]>([])
  const [produtos, setProdutos] = useState<Produto[] | null>(null)
  const [produtosErr, setProdutosErr] = useState('')

  const load = async () => {
    setLoading(true)
    try {
      const [r, c] = await Promise.all([api.get('/tmb/config'), api.get('/courses/categories')])
      setConfig(r.data.config); setStatus(r.data.status); setOffers(r.data.offers); setEvents(r.data.events)
      setDbCats(c.data)
      if (r.data.status.api_token) {
        api.get('/tmb/produtos').then(p => setProdutos(p.data)).catch(e => setProdutosErr(e.response?.data?.error || 'Não foi possível listar os produtos'))
      }
    } catch { toast.error('Erro ao carregar') } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  // categorias com cursos primeiro, depois as do menu sem cursos
  const catNames = [...new Set([...dbCats.map(c => c.category), ...MENU_CATEGORY_NAMES])]
  const countOf = (n: string) => dbCats.find(c => c.category === n)?.count || 0
  const priceOf = (n: string) => dbCats.find(c => c.category === n)?.min_price

  const setCat = (name: string, k: keyof CatCfg, v: unknown) =>
    setConfig(c => ({ ...c, categories: { ...c.categories, [name]: { ...emptyCat, ...c.categories[name], [k]: v } } }))

  const save = async () => {
    setSaving(true)
    try { const r = await api.put('/tmb/config', config); setConfig(r.data.config); toast.success('Configuração salva') }
    catch { toast.error('Erro ao salvar') } finally { setSaving(false) }
  }

  const toggleOffer = async (o: Offer) => {
    await api.put(`/tmb/offers/${o.id}`, { active: !o.active })
    setOffers(os => os.map(x => x.id === o.id ? { ...x, active: !x.active } : x))
  }

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('Copiado') }
  const brl = (n: unknown) => Number(n || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

  if (loading) return <div className="p-12 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>

  const ok = (b: boolean, yes: string, no: string) => (
    <p className={`flex items-start gap-2 text-sm ${b ? 'text-green-700' : 'text-amber-700'}`}>
      {b ? <CheckCircle size={16} className="shrink-0 mt-0.5" /> : <AlertTriangle size={16} className="shrink-0 mt-0.5" />} {b ? yes : no}
    </p>
  )

  return (
    <div className="p-8 max-w-6xl space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pagamentos TMB</h1>
          <p className="text-gray-500">Parcelado sem cartão (PIX ou boleto) dentro do botão &quot;Matricular agora&quot;. A TMB analisa o cadastro, cobra as parcelas e repassa o valor.</p>
        </div>
        <button onClick={load} className="p-2 text-gray-400 hover:text-primary-600 bg-white rounded-lg border border-gray-200" title="Atualizar"><RefreshCw size={18} /></button>
      </div>

      {/* Situação */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-2">
        <h2 className="font-bold text-gray-900 mb-2">Situação da integração</h2>
        {ok(!!status?.api_token, 'Token da API da TMB configurado no servidor: o site cria as ofertas sozinho, no preço de cada curso.', 'Sem token da API (TMB_API_TOKEN no .env). Sem ele, só funcionam os links fixos que você cadastrar abaixo, e apenas para cursos com o mesmo preço do link.')}
        {ok(!!status?.webhook_token, 'Token do webhook configurado: os pedidos são confirmados sozinhos quando a entrada é paga.', 'Sem TMB_WEBHOOK_TOKEN no .env: a TMB não consegue avisar o site, e você teria de marcar os pedidos como pagos à mão.')}
        {ok(!!status?.ga4_api_secret, 'Vendas da TMB são enviadas ao Google Analytics pelo servidor.', 'Sem GA4_API_SECRET no .env: as vendas da TMB não aparecem no Google Analytics (acontecem fora do site).')}
        <div className="mt-4 p-4 rounded-xl bg-gray-50 border border-gray-100 text-sm space-y-2">
          <p className="font-semibold text-gray-800">Na TMB, em cada produto: Integrações → Webhook Vendas → Nova configuração</p>
          <div className="grid grid-cols-1 md:grid-cols-[110px_1fr] gap-x-3 gap-y-1.5 items-center">
            <span className="text-gray-500">URL</span>
            <span className="flex items-center gap-2 font-mono text-xs break-all">{status?.webhook_url}
              <button onClick={() => copy(status?.webhook_url || '')} className="text-primary-600"><Copy size={14} /></button></span>
            <span className="text-gray-500">Chave</span>
            <span className="flex items-center gap-2 font-mono text-xs">{status?.webhook_header}
              <button onClick={() => copy(status?.webhook_header || '')} className="text-primary-600"><Copy size={14} /></button></span>
            <span className="text-gray-500">Valor</span>
            <span className="text-xs text-gray-600">o mesmo texto de TMB_WEBHOOK_TOKEN no .env do servidor (peça ao programador; não fica visível aqui)</span>
          </div>
          <p className="text-xs text-gray-500">Faça o mesmo em &quot;Webhook Etapas do Checkout&quot; se quiser acompanhar em que passo o aluno parou (aparece em Pedidos).</p>
        </div>
      </div>

      {/* Configuração */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <h2 className="font-bold text-gray-900">Onde oferecer</h2>
          <label className="flex items-center gap-2 text-sm font-semibold">
            <input type="checkbox" checked={config.enabled} onChange={e => setConfig(c => ({ ...c, enabled: e.target.checked }))} className="w-4 h-4" />
            Mostrar &quot;Parcelado sem cartão&quot; no checkout
          </label>
        </div>
        <p className="text-sm text-gray-500 mb-4">
          Para cada categoria, informe o <strong>ID do produto na TMB</strong> (Produtos → o código aparece no topo do produto) e em quantas parcelas oferecer.
          O valor mínimo aceito pela TMB é {brl(status?.min_value || 144)}. A taxa de juros do financiamento (padrão 3,49% a.m., de 1 a 36 parcelas), a entrada e a parcela mínima (padrão 3x; a página mostra todos os planos dela até o máximo) formam a tabela &quot;Boleto ou PIX parcelado&quot; da página do curso; a entrada também é enviada à TMB ao criar a oferta (só com o token da API; o link fixo usa a entrada que estiver no link). Vale para 1 curso por vez e sem cupom.
          {produtos && produtos.length > 0 && ' Os produtos da sua conta aparecem na lista.'}
          {produtosErr && <span className="text-amber-700"> ({produtosErr})</span>}
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-2 pr-3">Ativo</th><th className="py-2 pr-3">Categoria</th><th className="py-2 pr-3">Produto TMB (ID)</th>
                <th className="py-2 pr-3">Parcelas (máx.)</th><th className="py-2 pr-3">Link fixo (sem API)</th><th className="py-2">Valor do link</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {catNames.map(name => {
                const c = { ...emptyCat, ...config.categories[name] }
                return (
                  <Fragment key={name}>
                  <tr className={c.active ? '' : 'opacity-70'}>
                    <td className="py-2 pr-3"><input type="checkbox" checked={!!c.active} onChange={e => setCat(name, 'active', e.target.checked)} className="w-4 h-4" /></td>
                    <td className="py-2 pr-3">
                      <p className="font-medium text-gray-900">{menuLabel(name)}</p>
                      <p className="text-xs text-gray-400">{countOf(name)} cursos{priceOf(name) ? ` · a partir de ${brl(priceOf(name))}` : ''}</p>
                    </td>
                    <td className="py-2 pr-3">
                      {produtos && produtos.length > 0 ? (
                        <select className="input !py-1.5 min-w-[220px]" value={String(c.produto_id || '')} onChange={e => setCat(name, 'produto_id', e.target.value)}>
                          <option value="">—</option>
                          {produtos.map(p => <option key={p.produto_id} value={p.produto_id}>{p.produto_id} · {p.produto_nome}{p.ativo === false ? ' (inativo)' : ''}</option>)}
                        </select>
                      ) : (
                        <input className="input !py-1.5 w-32" inputMode="numeric" value={String(c.produto_id || '')} onChange={e => setCat(name, 'produto_id', e.target.value.replace(/\D/g, ''))} placeholder="ex.: 38494" />
                      )}
                    </td>
                    <td className="py-2 pr-3"><input className="input !py-1.5 w-20" inputMode="numeric" value={String(c.qtd_parcelas || '')} onChange={e => setCat(name, 'qtd_parcelas', e.target.value.replace(/\D/g, ''))} placeholder="24" /></td>
                    <td className="py-2 pr-3"><input className="input !py-1.5 min-w-[220px]" value={c.link_manual || ''} onChange={e => setCat(name, 'link_manual', e.target.value)} placeholder="https://pay.tmb.com.br/..." /></td>
                    <td className="py-2"><input className="input !py-1.5 w-28" inputMode="decimal" value={String(c.link_manual_valor || '')} onChange={e => setCat(name, 'link_manual_valor', e.target.value.replace(',', '.'))} placeholder="999.00" /></td>
                  </tr>
                  {c.active && (() => {
                    const preco = Number(priceOf(name) || 0)
                    const sim = preco ? tmbSimulate({ max_parcelas: Number(c.qtd_parcelas) || null, juros_mes: c.juros_mes === '' ? 3.49 : Number(String(c.juros_mes ?? 3.49).replace(',', '.')), entrada_tipo: c.entrada_tipo || 'percentual', entrada_valor: c.entrada_valor === '' ? 10 : Number(String(c.entrada_valor ?? 10).replace(',', '.')), parcela_minima: Number(c.parcela_minima) || 3 }, preco) : null
                    return (
                      <tr className="bg-gray-50/60">
                        <td />
                        <td colSpan={5} className="py-2 pr-3">
                          <div className="flex flex-wrap items-end gap-3 text-xs">
                            <label className="flex flex-col gap-1">Taxa de juros do financiamento (% a.m.)
                              <input className="input !py-1.5 w-20" inputMode="decimal" value={String(c.juros_mes ?? '')} onChange={e => setCat(name, 'juros_mes', e.target.value)} placeholder="3,49" /></label>
                            <label className="flex flex-col gap-1">Entrada
                              <span className="flex gap-1">
                                <input className="input !py-1.5 w-20" inputMode="decimal" value={String(c.entrada_valor ?? '')} onChange={e => setCat(name, 'entrada_valor', e.target.value)} placeholder="10" />
                                <select className="input !py-1.5 w-24" value={c.entrada_tipo || 'percentual'} onChange={e => setCat(name, 'entrada_tipo', e.target.value)}>
                                  <option value="percentual">% do preço</option><option value="valor">R$ fixo</option>
                                </select>
                              </span></label>
                            <label className="flex flex-col gap-1">Mostrar planos a partir de
                              <span className="flex items-center gap-1"><input className="input !py-1.5 w-16" inputMode="numeric" value={String(c.parcela_minima ?? '')} onChange={e => setCat(name, 'parcela_minima', e.target.value.replace(/\D/g, ''))} placeholder="3" /> parcelas até o máximo</span></label>
                            {sim && (
                              <p className="text-gray-600 pb-2">
                                Prévia ({brl(preco)}): entrada {brl(sim.entrada)} · {sim.opcoes.length} planos · {sim.opcoes.length ? `${nx(sim.opcoes[0].parcelas)} ${brl(sim.opcoes[0].valor)} … ${nx(sim.opcoes[sim.opcoes.length - 1].parcelas)} ${brl(sim.opcoes[sim.opcoes.length - 1].valor)}` : ''}
                              </p>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })()}
                  </Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="mt-5 flex items-center gap-3">
          <button onClick={save} disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} Salvar</button>
          <p className="text-xs text-gray-400">Atenção: produtos e ofertas da TMB têm data de término. Produto vencido faz o link dar &quot;Oferta expirada&quot;. Renove na TMB antes do fim.</p>
        </div>
      </div>

      {/* Ofertas criadas */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-1">Ofertas criadas pelo site</h2>
        <p className="text-sm text-gray-500 mb-4">Uma por produto, preço e número de parcelas, reaproveitada pelos cursos com o mesmo preço. Desative uma oferta para o site criar outra na próxima venda.</p>
        {offers.length === 0 ? <p className="text-sm text-gray-400">Nenhuma ainda.</p> : (
          <ul className="divide-y divide-gray-50 text-sm">
            {offers.map(o => (
              <li key={o.id} className="py-2 flex flex-wrap items-center gap-3">
                <span className={`badge ${o.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{o.active ? 'ativa' : 'inativa'}</span>
                <span className="font-medium">{menuLabel(o.category || '')}</span>
                <span>{brl(o.valor)} · {o.qtd_parcelas}x · produto {o.produto_id}</span>
                <a href={o.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 flex items-center gap-1"><ExternalLink size={14} /> abrir</a>
                <button onClick={() => toggleOffer(o)} className="text-xs text-gray-500 hover:text-primary-600 ml-auto">{o.active ? 'Desativar' : 'Reativar'}</button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Últimos avisos da TMB */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 mb-4">Últimos avisos recebidos da TMB</h2>
        {events.length === 0 ? <p className="text-sm text-gray-400">Nenhum aviso recebido ainda.</p> : (
          <ul className="divide-y divide-gray-50 text-sm">
            {events.map(e => (
              <li key={e.id} className="py-2 flex flex-wrap gap-3">
                <span className="text-gray-400 text-xs w-32">{new Date(e.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="font-medium">{e.status_pedido || e.fase_checkout || 'evento'}</span>
                <span className="text-gray-500">pedido TMB {e.tmb_order_id || '—'}</span>
                <span className={e.order_id ? 'text-green-700' : 'text-amber-700'}>{e.order_id ? `pedido do site #${e.order_id}` : 'sem pedido do site correspondente'}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
