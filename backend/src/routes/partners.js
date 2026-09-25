// v2.4: parceiros – instituições de ensino (IES) e empresas/convênios, com página própria.
const router = require('express').Router()
const slugify = require('slugify')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')

const TYPES = ['ies', 'empresa']
const LIST_FIELDS = `id, type, slug, name, logo, cover_image, summary, website, city, state,
                     emec_code, benefit, featured, order_index, updated_at`

// Público: parceiros ativos (?type=ies|empresa)
router.get('/', async (req, res) => {
  try {
    const params = []
    let where = 'active = true'
    if (TYPES.includes(req.query.type)) { params.push(req.query.type); where += ` AND type = $${params.length}` }
    const { rows } = await pool.query(
      `SELECT ${LIST_FIELDS} FROM partners WHERE ${where} ORDER BY featured DESC, order_index, name`, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar parceiros' })
  }
})

// Público: página do parceiro (+ cursos da categoria relacionada)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM partners WHERE slug = $1 AND active = true`, [req.params.slug])
    if (!rows.length) return res.status(404).json({ error: 'Parceiro não encontrado' })
    const p = rows[0]
    delete p.active
    const { rows: courses } = await pool.query(
      `SELECT id, slug, title, subtitle, cover_image, workload, modality, duration, category,
              price_pix, price_installment, installments, installment_value, featured
       FROM courses WHERE active = true AND category = $1
       ORDER BY featured DESC, created_at DESC LIMIT 6`, [p.related_category || '__nenhuma__'])
    p.related_courses = courses
    // cupom do convênio: só mostra se estiver ativo e dentro da validade
    if (p.coupon_code) {
      const { rows: cp } = await pool.query(
        `SELECT code, discount_percent FROM coupons WHERE code = $1 AND active = true
           AND (expires_at IS NULL OR expires_at > NOW()) AND (max_uses IS NULL OR used_count < max_uses)`,
        [String(p.coupon_code).trim().toUpperCase()])
      p.coupon = cp[0] ? { code: cp[0].code, discount_percent: Number(cp[0].discount_percent) } : null
    }
    delete p.coupon_code
    res.json(p)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar parceiro' })
  }
})

// Admin
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT p.*, (SELECT c.active FROM coupons c WHERE c.code = upper(p.coupon_code)) AS coupon_active
       FROM partners p ORDER BY p.type, p.order_index, p.name`)
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar parceiros' }) }
})

router.get('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM partners WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Parceiro não encontrado' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar parceiro' }) }
})

const str = (v, max) => { const t = String(v ?? '').trim(); return t ? t.slice(0, max) : null }
const url = v => { const t = str(v, 500); return t && !/^(https?:\/\/|\/)/i.test(t) ? `https://${t}` : t }

function fields(b) {
  return {
    type: TYPES.includes(b.type) ? b.type : 'ies',
    name: str(b.name, 255),
    logo: str(b.logo, 500),
    cover_image: str(b.cover_image, 500),
    summary: str(b.summary, 600),
    content: b.content || null,
    website: url(b.website),
    city: str(b.city, 120),
    state: str(b.state, 2)?.toUpperCase() || null,
    emec_code: str(b.emec_code, 30),
    emec_url: url(b.emec_url),
    accreditation: str(b.accreditation, 2000),
    mec_score: str(b.mec_score, 20),
    benefit: str(b.benefit, 300),
    coupon_code: str(b.coupon_code, 100)?.toUpperCase() || null,
    eligibility: str(b.eligibility, 2000),
    related_category: str(b.related_category, 100),
    whatsapp_message: str(b.whatsapp_message, 1000),
    featured: !!b.featured,
    active: b.active === undefined ? true : !!b.active,
    order_index: parseInt(b.order_index) || 0,
    seo_title: str(b.seo_title, 500),
    seo_description: str(b.seo_description, 500),
  }
}

async function save(req, res, id) {
  const f = fields(req.body || {})
  if (!f.name) return res.status(400).json({ error: 'Nome obrigatório' })
  const slug = slugify(req.body.slug || f.name, { lower: true, strict: true, locale: 'pt' })
  if (!slug) return res.status(400).json({ error: 'Endereço (slug) inválido' })
  const cols = Object.keys(f)
  const vals = Object.values(f)
  try {
    let rows
    if (id) {
      const set = cols.map((c, i) => `${c} = $${i + 2}`).join(', ')
      ;({ rows } = await pool.query(`UPDATE partners SET slug = $1, ${set} WHERE id = $${cols.length + 2} RETURNING *`, [slug, ...vals, id]))
      if (!rows.length) return res.status(404).json({ error: 'Parceiro não encontrado' })
    } else {
      ;({ rows } = await pool.query(
        `INSERT INTO partners (slug, ${cols.join(', ')}) VALUES ($1, ${cols.map((_, i) => `$${i + 2}`).join(', ')}) RETURNING *`, [slug, ...vals]))
    }
    res.status(id ? 200 : 201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um parceiro com esse endereço (slug)' })
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar parceiro' })
  }
}

router.post('/', requireAuth, (req, res) => save(req, res, null))
router.put('/:id', requireAuth, (req, res) => save(req, res, req.params.id))

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM partners WHERE id = $1', [req.params.id])
    res.json({ message: 'Parceiro removido' })
  } catch (err) { res.status(500).json({ error: 'Erro ao remover parceiro' }) }
})

module.exports = router
