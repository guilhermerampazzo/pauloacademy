const router = require('express').Router()
const slugify = require('slugify')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')

const PUBLIC_FIELDS = `id, slug, title, excerpt, cover_image, related_category, author,
                       published_at, updated_at, seo_title, seo_description`

// Público: posts publicados
router.get('/', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 24, 100)
    const params = [limit]
    let where = 'published = true AND (published_at IS NULL OR published_at <= NOW())'
    if (req.query.category) {
      params.push(req.query.category)
      where += ` AND related_category = $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_FIELDS} FROM blog_posts WHERE ${where}
       ORDER BY COALESCE(published_at, created_at) DESC LIMIT $1`,
      params
    )
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar posts' })
  }
})

// Público: post por slug (+ cursos relacionados para link interno)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT ${PUBLIC_FIELDS}, content FROM blog_posts
       WHERE slug = $1 AND published = true AND (published_at IS NULL OR published_at <= NOW())`,
      [req.params.slug]
    )
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' })
    const post = rows[0]
    const { rows: courses } = await pool.query(
      `SELECT id, slug, title, subtitle, cover_image, workload, modality, duration, category,
              price_pix, installments, installment_value, featured
       FROM courses WHERE active = true AND ($1::text IS NULL OR category = $1)
       ORDER BY featured DESC, created_at DESC LIMIT 3`,
      [post.related_category || null]
    )
    post.related_courses = courses
    res.json(post)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar post' })
  }
})

// Admin
router.get('/admin/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM blog_posts ORDER BY created_at DESC')
    res.json(rows)
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar posts' }) }
})

router.get('/admin/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM blog_posts WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' })
    res.json(rows[0])
  } catch (err) { res.status(500).json({ error: 'Erro ao buscar post' }) }
})

function fields(body) {
  return [
    String(body.title || '').trim(),
    body.excerpt || null,
    body.content || '',
    body.cover_image || null,
    body.related_category || null,
    body.author || null,
    !!body.published,
    body.published_at || null,
    body.seo_title || null,
    body.seo_description || null,
  ]
}

router.post('/', requireAuth, async (req, res) => {
  try {
    const f = fields(req.body)
    if (!f[0]) return res.status(400).json({ error: 'Título obrigatório' })
    const slug = slugify(req.body.slug || f[0], { lower: true, strict: true, locale: 'pt' })
    const { rows } = await pool.query(
      `INSERT INTO blog_posts (slug, title, excerpt, content, cover_image, related_category, author,
                               published, published_at, seo_title, seo_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, CASE WHEN $8 AND $9::timestamp IS NULL THEN NOW() ELSE $9::timestamp END, $10,$11) RETURNING *`,
      [slug, ...f]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um post com esse endereço (slug)' })
    console.error(err)
    res.status(500).json({ error: 'Erro ao criar post' })
  }
})

router.put('/:id', requireAuth, async (req, res) => {
  try {
    const f = fields(req.body)
    if (!f[0]) return res.status(400).json({ error: 'Título obrigatório' })
    const slug = slugify(req.body.slug || f[0], { lower: true, strict: true, locale: 'pt' })
    const { rows } = await pool.query(
      `UPDATE blog_posts SET slug=$1, title=$2, excerpt=$3, content=$4, cover_image=$5, related_category=$6,
              author=$7, published=$8,
              published_at = CASE WHEN $8 AND $9::timestamp IS NULL THEN COALESCE(published_at, NOW()) ELSE $9::timestamp END,
              seo_title=$10, seo_description=$11
       WHERE id=$12 RETURNING *`,
      [slug, ...f, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Post não encontrado' })
    res.json(rows[0])
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Já existe um post com esse endereço (slug)' })
    console.error(err)
    res.status(500).json({ error: 'Erro ao salvar post' })
  }
})

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM blog_posts WHERE id = $1', [req.params.id])
    res.json({ message: 'Post removido' })
  } catch (err) { res.status(500).json({ error: 'Erro ao remover post' }) }
})

module.exports = router
