// v2.4: integração com a TMB (Tem Mais no Boleto) – parcelado sem cartão no PIX ou boleto.
//
// Como funciona:
// 1) No admin (Pagamentos TMB) o Paulo liga a integração e informa, para cada categoria,
//    o ID do produto na TMB e a quantidade de parcelas.
// 2) No checkout, "Parcelado sem cartão" cria o pedido (pendente) e pega um link de oferta
//    da TMB com o preço do curso: reaproveita a oferta já criada para aquele produto/preço/parcelas
//    (tabela tmb_offers) ou cria uma nova pela API (POST /api/ofertas).
// 3) O cliente é levado ao checkout da TMB com utm_content=pedido-<id>.
// 4) O webhook de Vendas da TMB (POST /api/orders/webhook/tmb) confirma o pedido quando a
//    entrada é paga ("Efetivado") e registra o cancelamento ("Cancelado").
//
// Segredos ficam só no .env: TMB_API_TOKEN (Produtos > TMB API) e TMB_WEBHOOK_TOKEN
// (o mesmo valor informado no campo "Valor" da configuração do webhook na TMB).
const crypto = require('crypto')
const { pool } = require('../db')

const API = (process.env.TMB_API_URL || 'https://api.tmbeducacao.com.br').replace(/\/$/, '')
const MIN_VALUE = 144 // valor mínimo do ticket informado na documentação de Ofertas da TMB
const SETTINGS_KEY = 'tmb'

const round2 = n => Math.round(Number(n) * 100) / 100

function tokenConfigured() { return !!process.env.TMB_API_TOKEN }
function webhookTokenConfigured() { return !!process.env.TMB_WEBHOOK_TOKEN }

const DEFAULT_CONFIG = { enabled: false, categories: {} }
const DEFAULT_JUROS = 3.49         // Taxa Juros Financiamento (% a.m., de 1 a 36 parcelas) – editável por categoria em Pagamentos TMB
const DEFAULT_PARCELA_MINIMA = 3   // a página mostra todos os planos do link a partir de 3 parcelas
const DEFAULT_ENTRADA_PCT = 10     // entrada padrão: 10% do preço (enviada à TMB em valor_boleto_entrada)

function parcelaMinima(v) {
  const n = parseInt(v)
  return n >= 1 && n <= 36 ? n : DEFAULT_PARCELA_MINIMA
}

/** Valor da entrada para um preço (percentual do preço ou valor fixo), nunca acima de 50% do preço */
function entradaPara(c, price) {
  if (c && c.entrada_valor === undefined) c = { ...c, entrada_valor: DEFAULT_ENTRADA_PCT, entrada_tipo: 'percentual' }
  if (!c?.entrada_valor) return 0
  const v = c.entrada_tipo === 'valor' ? Number(c.entrada_valor) : price * Number(c.entrada_valor) / 100
  return round2(Math.min(Math.max(v, 0), price / 2))
}

/** Simulação exibida na página: entrada + parcelas pela tabela Price (juros compostos ao mês) */
function simulate(c, price) {
  const juros = c?.juros_mes ?? DEFAULT_JUROS
  const entrada = entradaPara(c, price)
  const financiado = round2(price - entrada)
  const max = c?.qtd_parcelas || 36
  const i = juros / 100
  // v2.4: todos os planos do link, da parcela mínima (padrão 12) até o máximo do produto
  const lista = []
  for (let n = Math.min(parcelaMinima(c?.parcela_minima), max); n <= max; n++) lista.push(n)
  const opcoes = lista.map(n => ({
    parcelas: n,
    valor: round2(i > 0 ? financiado * i / (1 - Math.pow(1 + i, -n)) : financiado / n),
  }))
  return { entrada, juros_mes: juros, opcoes }
}

/** Configuração salva no admin (tabela app_settings, fora da API pública /content) */
async function getConfig() {
  const { rows } = await pool.query('SELECT data FROM app_settings WHERE key = $1', [SETTINGS_KEY])
  const data = rows[0]?.data || {}
  return { ...DEFAULT_CONFIG, ...data, categories: data.categories || {} }
}

async function saveConfig(input) {
  const categories = {}
  for (const [name, c] of Object.entries(input?.categories || {})) {
    if (!name) continue
    const produto_id = parseInt(c?.produto_id) || null
    const qtd_parcelas = Math.min(Math.max(parseInt(c?.qtd_parcelas) || 0, 0), 36) || null
    categories[name] = {
      active: !!c?.active,
      produto_id,
      qtd_parcelas,
      // Link fixo (opcional): usado quando não há token da API. Só vale para cursos com o mesmo preço.
      link_manual: String(c?.link_manual || '').trim() || null,
      link_manual_valor: c?.link_manual_valor ? round2(c.link_manual_valor) : null,
      // v2.4: tabela "Boleto/PIX parcelado" da página do curso
      juros_mes: c?.juros_mes === '' || c?.juros_mes === null || c?.juros_mes === undefined
        ? DEFAULT_JUROS : Math.min(Math.max(Number(String(c.juros_mes).replace(',', '.')) || 0, 0), 20),
      entrada_tipo: c?.entrada_tipo === 'valor' ? 'valor' : 'percentual',
      // vazio = 10% do preço; 0 = sem entrada personalizada (a TMB aplica a regra padrão dela)
      entrada_valor: c?.entrada_valor === undefined || c?.entrada_valor === null || String(c.entrada_valor).trim() === ''
        ? DEFAULT_ENTRADA_PCT : Math.max(Number(String(c.entrada_valor).replace(',', '.')) || 0, 0),
      parcela_minima: parcelaMinima(c?.parcela_minima),
    }
  }
  const data = { enabled: !!input?.enabled, categories }
  await pool.query(
    `INSERT INTO app_settings (key, data, updated_at) VALUES ($1, $2, NOW())
     ON CONFLICT (key) DO UPDATE SET data = $2, updated_at = NOW()`,
    [SETTINGS_KEY, JSON.stringify(data)]
  )
  return data
}

/** Regra de disponibilidade para um carrinho já calculado (priceCart) */
function availability(config, quote) {
  const none = { available: false, reason: null, max_parcelas: null }
  if (!config?.enabled || !quote?.items?.length) return none
  const cats = [...new Set(quote.items.map(i => i.category))]
  const catCfg = cats.length === 1 ? config.categories[cats[0]] : null
  const anyConfigured = cats.some(c => config.categories[c]?.active)
  if (!anyConfigured) return none
  if (quote.items.length > 1) return { ...none, reason: 'O parcelado sem cartão vale para 1 curso por vez.' }
  if (!catCfg?.active) return none
  if (quote.coupon) return { ...none, reason: 'O parcelado sem cartão não aceita cupom de desconto.' }
  const price = quote.items[0].final_price
  if (price < MIN_VALUE) return none
  const viaApi = tokenConfigured() && catCfg.produto_id && catCfg.qtd_parcelas
  const viaLink = catCfg.link_manual && catCfg.link_manual_valor && Math.abs(catCfg.link_manual_valor - price) < 0.01
  if (!viaApi && !viaLink) return none
  return { available: true, reason: null, max_parcelas: catCfg.qtd_parcelas || null }
}

async function request(path, { method = 'GET', body } = {}) {
  if (!tokenConfigured()) throw new Error('TMB_API_TOKEN não configurado')
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), 15000)
  try {
    const res = await fetch(`${API}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${process.env.TMB_API_TOKEN}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    })
    const text = await res.text()
    let data
    try { data = text ? JSON.parse(text) : null } catch { data = text }
    if (!res.ok) {
      const msg = (data && (data.message || data.error || data.title)) || text || res.statusText
      throw new Error(`TMB ${res.status}: ${String(msg).slice(0, 300)}`)
    }
    return data
  } finally {
    clearTimeout(timer)
  }
}

/** Lista de produtos da conta na TMB (ajuda a escolher o ID no admin) */
async function listProdutos() {
  const data = await request('/api/produtos')
  return Array.isArray(data) ? data : (data?.data || [])
}

/**
 * Link de oferta para um produto/preço/parcelas. Reaproveita a oferta já criada.
 * Retorna { url, source: 'cache' | 'api' | 'manual' }.
 */
async function getOfferUrl({ category, price }) {
  const config = await getConfig()
  const c = config.categories[category]
  if (!c?.active) throw new Error(`TMB não configurada para a categoria ${category}`)
  const valor = round2(price)

  if (tokenConfigured() && c.produto_id && c.qtd_parcelas) {
    const entrada = entradaPara(c, valor)
    const { rows } = await pool.query(
      `SELECT url FROM tmb_offers WHERE produto_id = $1 AND valor = $2 AND qtd_parcelas = $3
         AND COALESCE(valor_entrada, 0) = $4 AND active = true
       ORDER BY created_at DESC LIMIT 1`,
      [c.produto_id, valor, c.qtd_parcelas, entrada]
    )
    if (rows[0]?.url) return { url: rows[0].url, source: 'cache' }

    const titulo = `AcademyPop ${category} R$ ${valor.toFixed(2).replace('.', ',')} ${c.qtd_parcelas}x`.slice(0, 100)
    const data = await request('/api/ofertas', {
      method: 'POST',
      body: {
        titulo, produto_id: c.produto_id, valor_principal: valor, qtd_parcelas: String(c.qtd_parcelas),
        // v2.4: entrada configurada no admin (a mesma mostrada na página do curso)
        ...(entrada > 0 ? { valor_boleto_entrada: entrada } : {}),
      },
    })
    const url = data?.url || data?.link || data?.data?.url
    if (!url || !/^https:\/\//.test(url)) throw new Error('A TMB não devolveu o link da oferta')
    await pool.query(
      `INSERT INTO tmb_offers (category, produto_id, valor, qtd_parcelas, valor_entrada, titulo, url)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [category, c.produto_id, valor, c.qtd_parcelas, entrada || null, titulo, url]
    )
    return { url, source: 'api' }
  }

  if (c.link_manual && c.link_manual_valor && Math.abs(c.link_manual_valor - valor) < 0.01) {
    return { url: c.link_manual, source: 'manual' }
  }
  throw new Error('Sem token da API da TMB e sem link fixo com esse preço')
}

/** Acrescenta as UTMs que voltam no webhook (identificam o pedido e o curso) */
function withUtm(url, { orderId, slug }) {
  const u = new URL(url)
  u.searchParams.set('utm_source', 'academypop')
  u.searchParams.set('utm_medium', 'site')
  u.searchParams.set('utm_campaign', String(slug || 'curso').slice(0, 80))
  u.searchParams.set('utm_content', `pedido-${orderId}`)
  return u.toString()
}

/** Confere o cabeçalho de autenticação do webhook (Chave: x-tmb-token / Valor: TMB_WEBHOOK_TOKEN) */
function verifyWebhook(req) {
  const expected = process.env.TMB_WEBHOOK_TOKEN || ''
  if (!expected) return false
  const headerName = (process.env.TMB_WEBHOOK_HEADER || 'x-tmb-token').toLowerCase()
  let got = String(req.headers[headerName] || '')
  if (/^bearer\s+/i.test(got)) got = got.replace(/^bearer\s+/i, '')
  const a = Buffer.from(got)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}

/** Número do pedido do site a partir das UTMs do webhook */
function orderIdFromPayload(p) {
  for (const v of [p?.utm_content, p?.utm_last_content, p?.id_externo]) {
    const m = String(v || '').match(/pedido-(\d+)/i)
    if (m) return Number(m[1])
  }
  return null
}

module.exports = {
  MIN_VALUE, DEFAULT_PARCELA_MINIMA, DEFAULT_JUROS, DEFAULT_ENTRADA_PCT, simulate, getConfig, saveConfig, availability, listProdutos, getOfferUrl, withUtm,
  verifyWebhook, orderIdFromPayload, tokenConfigured, webhookTokenConfigured,
}
