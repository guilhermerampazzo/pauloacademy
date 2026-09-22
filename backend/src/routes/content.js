const router = require('express').Router()
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM content_sections ORDER BY key')
    const result = {}
    rows.forEach(r => { result[r.key] = r.data })
    res.json(result)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar conteúdo' })
  }
})

// Depoimentos públicos (home e páginas de categoria)
// ?course_id=  -> só daquele curso; ?category= -> de cursos da categoria; sem nada -> todos ativos
router.get('/testimonials/public', async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 6, 30)
    const params = [limit]
    let where = 't.active = true'
    if (req.query.category) {
      params.push(req.query.category)
      where += ` AND c.category = $${params.length}`
    }
    const { rows } = await pool.query(
      `SELECT t.id, t.name, t.role, t.content, t.photo, c.title AS course_title, c.slug AS course_slug, c.category
       FROM testimonials t LEFT JOIN courses c ON c.id = t.course_id
       WHERE ${where} ORDER BY t.order_index, t.created_at DESC LIMIT $1`,
      params
    )
    res.set('Cache-Control', 'public, max-age=120')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar depoimentos' })
  }
})

router.get('/:key', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM content_sections WHERE key = $1', [req.params.key])
    if (!rows.length) return res.status(404).json({ error: 'Seção não encontrada' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar conteúdo' })
  }
})

router.put('/:key', requireAuth, async (req, res) => {
  try {
    const { data, title } = req.body
    const { rows } = await pool.query(
      `INSERT INTO content_sections (key, title, data) VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET data = $3, title = $2, updated_at = NOW()
       RETURNING *`,
      [req.params.key, title, JSON.stringify(data)]
    )
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Erro ao atualizar conteúdo' })
  }
})

// Depoimentos
router.get('/testimonials/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM testimonials ORDER BY order_index, created_at DESC')
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erro' })
  }
})

router.post('/testimonials', requireAuth, async (req, res) => {
  try {
    const { name, role, content, photo, course_id, active, order_index } = req.body
    const { rows } = await pool.query(
      'INSERT INTO testimonials (name, role, content, photo, course_id, active, order_index) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [name, role, content, photo, course_id || null, active ?? true, order_index ?? 0]
    )
    res.status(201).json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Erro' })
  }
})

router.put('/testimonials/:id', requireAuth, async (req, res) => {
  try {
    const { name, role, content, photo, course_id, active, order_index } = req.body
    const { rows } = await pool.query(
      'UPDATE testimonials SET name=$1,role=$2,content=$3,photo=$4,course_id=$5,active=$6,order_index=$7 WHERE id=$8 RETURNING *',
      [name, role, content, photo, course_id || null, active, order_index, req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Não encontrado' })
    res.json(rows[0])
  } catch (err) {
    res.status(500).json({ error: 'Erro' })
  }
})

router.delete('/testimonials/:id', requireAuth, async (req, res) => {
  try {
    await pool.query('DELETE FROM testimonials WHERE id = $1', [req.params.id])
    res.json({ message: 'Deletado' })
  } catch (err) {
    res.status(500).json({ error: 'Erro' })
  }
})

module.exports = router
