const router = require('express').Router()
const rateLimit = require('express-rate-limit')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')

// Busca instantânea de cursos
// PostgreSQL full-text (português) + unaccent + pg_trgm.
// Pesos: A = título, B = categoria + sinônimos, C = módulos/disciplinas,
//        D = subtítulo + descrição. Ver refresh_course_search() em schema.sql.

const strip = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function tokenize(q) {
  return strip(q).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean).slice(0, 8)
}

const RESULT_FIELDS = `c.id, c.slug, c.title, c.subtitle, c.category, c.cover_image, c.workload, c.duration,
  c.modality, c.price_pix, c.price_installment, c.installments, c.installment_value, c.featured,
  c.search_title, c.search_disciplines, c.search_text`

// Casa pelo índice em português (gestão ~ gestor) OU pelo índice simples (prefixo exato)
const FTS = `(c.search_tsv @@ to_tsquery('portuguese', $1) OR c.search_tsv_simple @@ to_tsquery('simple', $1))`

const SORTS = {
  relevance: 'score DESC, c.featured DESC, c.created_at DESC',
  price_asc: 'NULLIF(c.price_pix, 0) ASC NULLS LAST, score DESC',
  price_desc: 'c.price_pix DESC, score DESC',
  workload_asc: 'c.workload ASC NULLS LAST, score DESC',
  workload_desc: 'c.workload DESC NULLS LAST, score DESC',
  recent: 'c.created_at DESC',
}

// Explica por que o curso apareceu quando o termo não está no título
function matchReason(row, tokens) {
  const missing = tokens.filter(t => t.length >= 3 && !row.search_title.includes(t))
  if (!missing.length) return null
  const disciplines = String(row.search_disciplines || '').split(' | ').filter(Boolean)
  for (const t of missing) {
    const d = disciplines.find(x => strip(x).includes(t))
    if (d) return { type: 'disciplina', text: d }
  }
  if (missing.some(t => strip(row.category).includes(t))) return null
  return { type: 'conteudo', text: null }
}

async function suggest(tokens) {
  // "Você quis dizer": troca cada termo pela palavra mais parecida dos títulos/disciplinas
  const out = []
  let changed = false
  for (const t of tokens) {
    if (t.length < 3) { out.push(t); continue }
    const { rows } = await pool.query(
      `SELECT w, similarity(w, $1) AS s FROM (
         SELECT DISTINCT unnest(regexp_split_to_array(search_title || ' ' || lower(f_unaccent(coalesce(search_disciplines, ''))), '[^a-z0-9]+')) AS w
         FROM courses WHERE active = true
       ) x WHERE length(w) >= 3 ORDER BY s DESC LIMIT 1`,
      [t]
    )
    const best = rows[0]
    if (best && best.s >= 0.3 && best.w !== t) { out.push(best.w); changed = true } else out.push(t)
  }
  return changed ? out.join(' ') : null
}

router.get('/', async (req, res) => {
  try {
    const q = String(req.query.q || '').slice(0, 100)
    const tokens = tokenize(q)
    const category = req.query.categoria || req.query.category || ''
    const maxPrice = parseFloat(req.query.preco_max) || 0
    const minWorkload = parseInt(req.query.ch_min) || 0
    const maxWorkload = parseInt(req.query.ch_max) || 0
    const sort = SORTS[req.query.ordem] ? req.query.ordem : 'relevance'
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 8, 1), 60)
    const offset = Math.max(parseInt(req.query.offset) || 0, 0)

    const params = []
    const where = ['c.active = true']
    let score = '0'
    let usedFuzzy = false

    if (tokens.length) {
      const raw = tokens.join(' ')
      const tsq = tokens.map(t => `${t}:*`).join(' & ')
      params.push(tsq, raw)
      score = `(GREATEST(ts_rank(c.search_tsv, to_tsquery('portuguese', $1), 1), ts_rank(c.search_tsv_simple, to_tsquery('simple', $1), 1)) * 4
               + CASE WHEN c.search_title LIKE '%' || $2 || '%' THEN 3 ELSE 0 END
               + word_similarity($2, c.search_title))`

      // 1ª tentativa: full-text com prefixo (refina a cada letra digitada)
      const { rows: probe } = await pool.query(
        `SELECT COUNT(*)::int AS n FROM courses c WHERE c.active = true AND ${FTS}`,
        [tsq]
      )
      if (probe[0].n > 0) {
        where.push(FTS)
      } else {
        // 2ª tentativa: tolerância a erro de digitação (trigramas)
        usedFuzzy = true
        where.push(`(word_similarity($2, c.search_text) >= 0.45 OR word_similarity($2, c.search_title) >= 0.4)`)
      }
    }

    // Todos os resultados que casam com o termo (para contar por categoria)
    const { rows: all } = await pool.query(
      `SELECT ${RESULT_FIELDS}, c.created_at, ${score} AS score
       FROM courses c WHERE ${where.join(' AND ')}
       ORDER BY ${SORTS.relevance}`,
      params
    )

    const facets = {}
    all.forEach(r => { facets[r.category] = (facets[r.category] || 0) + 1 })

    let filtered = all
    if (category) filtered = filtered.filter(r => r.category === category)
    if (maxPrice > 0) filtered = filtered.filter(r => Number(r.price_pix) > 0 && Number(r.price_pix) <= maxPrice)
    if (minWorkload > 0) filtered = filtered.filter(r => Number(r.workload) >= minWorkload)
    if (maxWorkload > 0) filtered = filtered.filter(r => Number(r.workload) <= maxWorkload)

    if (sort !== 'relevance') {
      const cmp = {
        price_asc: (a, b) => (Number(a.price_pix) || Infinity) - (Number(b.price_pix) || Infinity),
        price_desc: (a, b) => Number(b.price_pix) - Number(a.price_pix),
        workload_asc: (a, b) => (a.workload || 0) - (b.workload || 0),
        workload_desc: (a, b) => (b.workload || 0) - (a.workload || 0),
        recent: (a, b) => new Date(b.created_at) - new Date(a.created_at),
      }[sort]
      filtered = [...filtered].sort(cmp)
    }

    const page = filtered.slice(offset, offset + limit).map(r => {
      const reason = tokens.length ? matchReason(r, tokens) : null
      delete r.search_title; delete r.search_disciplines; delete r.search_text; delete r.created_at
      r.score = Number(r.score)
      return { ...r, reason }
    })

    const suggestion = tokens.length && (usedFuzzy || all.length === 0) ? await suggest(tokens) : null

    res.set('Cache-Control', 'public, max-age=30')
    res.json({
      query: q,
      total: filtered.length,
      total_all_categories: all.length,
      facets,
      fuzzy: usedFuzzy,
      suggestion,
      results: page,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro na busca' })
  }
})

// Termos mais buscados (sugestões quando o campo está vazio)
router.get('/popular', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT lower(term) AS term, COUNT(*)::int AS n FROM search_logs
       WHERE results > 0 AND created_at > NOW() - INTERVAL '30 days' AND length(term) >= 3
       GROUP BY lower(term) ORDER BY n DESC LIMIT 8`
    )
    res.set('Cache-Control', 'public, max-age=300')
    res.json(rows.map(r => r.term))
  } catch {
    res.json([])
  }
})

// Registro do termo buscado (o site envia quando o cliente para de digitar)
const logLimiter = rateLimit({ windowMs: 60 * 1000, limit: 30, standardHeaders: 'draft-7', legacyHeaders: false })
router.post('/log', logLimiter, async (req, res) => {
  try {
    const term = String(req.body?.term || '').trim().slice(0, 200)
    const results = Math.max(parseInt(req.body?.results) || 0, 0)
    if (term.length >= 2) {
      await pool.query('INSERT INTO search_logs (term, results, category) VALUES ($1, $2, $3)',
        [term, results, req.body?.category ? String(req.body.category).slice(0, 100) : null])
    }
    res.sendStatus(204)
  } catch {
    res.sendStatus(204)
  }
})

// Admin: relatório de buscas
router.get('/report', requireAuth, async (req, res) => {
  try {
    const days = Math.min(Math.max(parseInt(req.query.days) || 30, 1), 365)
    const [top, zero, totals] = await Promise.all([
      pool.query(
        `SELECT lower(term) AS term, COUNT(*)::int AS searches, ROUND(AVG(results))::int AS avg_results
         FROM search_logs WHERE created_at > NOW() - ($1 || ' days')::interval
         GROUP BY lower(term) ORDER BY searches DESC LIMIT 50`, [days]),
      pool.query(
        `SELECT lower(term) AS term, COUNT(*)::int AS searches, MAX(created_at) AS last_at
         FROM search_logs WHERE results = 0 AND created_at > NOW() - ($1 || ' days')::interval
         GROUP BY lower(term) ORDER BY searches DESC LIMIT 50`, [days]),
      pool.query(
        `SELECT COUNT(*)::int AS total, COUNT(*) FILTER (WHERE results = 0)::int AS zero
         FROM search_logs WHERE created_at > NOW() - ($1 || ' days')::interval`, [days]),
    ])
    res.json({ days, totals: totals.rows[0], top: top.rows, zero_results: zero.rows })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao gerar relatório' })
  }
})

module.exports = router
