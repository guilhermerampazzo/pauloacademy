const router = require('express').Router()
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')
const slugify = require('slugify')
const { normalizeDuration } = require('../lib/duration')

const refreshSearch = id => pool.query('SELECT refresh_course_search($1)', [id]).catch(e => console.error('refresh_course_search', e.message))

// Listar cursos públicos (ativos)
// Parâmetros opcionais:
//   category=Pós-Graduação   -> só a categoria
//   per_category=6           -> no máximo N por categoria (destaques primeiro) – usado na home
//   limit=12                 -> limite total
const LIST_FIELDS = `id, slug, title, subtitle, cover_image, workload, modality, duration, category,
                     price_pix, price_installment, installments, installment_value,
                     price_original, discount_percent,
                     active, featured, vacancy_count, offer_expires_at, updated_at`

router.get('/', async (req, res) => {
  try {
    const { category } = req.query
    const perCategory = Math.min(parseInt(req.query.per_category) || 0, 50)
    const limit = Math.min(parseInt(req.query.limit) || 0, 500)
    const params = []
    let where = 'active = true'
    if (category) {
      params.push(category)
      where += ` AND category = $${params.length}`
    }
    let query
    if (perCategory > 0) {
      params.push(perCategory)
      query = `SELECT ${LIST_FIELDS} FROM (
                 SELECT *, ROW_NUMBER() OVER (PARTITION BY category ORDER BY featured DESC, created_at DESC) AS rn
                 FROM courses WHERE ${where}
               ) t WHERE rn <= $${params.length}
               ORDER BY category, featured DESC, created_at DESC`
    } else {
      query = `SELECT ${LIST_FIELDS} FROM courses WHERE ${where} ORDER BY featured DESC, created_at DESC`
    }
    if (limit > 0) {
      params.push(limit)
      query += ` LIMIT $${params.length}`
    }
    const { rows } = await pool.query(query, params)
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar cursos' })
  }
})

// Categorias com contagem de cursos ativos (menu, páginas de categoria, filtros)
router.get('/categories', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT category, COUNT(*)::int AS count, MIN(price_pix) FILTER (WHERE price_pix > 0) AS min_price
       FROM courses WHERE active = true GROUP BY category ORDER BY COUNT(*) DESC`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar categorias' })
  }
})

// Lista enxuta para o sitemap.xml
router.get('/sitemap', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT slug, category, updated_at FROM courses WHERE active = true ORDER BY updated_at DESC'
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erro' })
  }
})

// Listar todos (admin)
router.get('/all', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, slug, title, subtitle, cover_image, workload, modality, duration, category,
              price_pix, price_installment, installments, installment_value,
              price_original, discount_percent,
              active, featured, created_at
       FROM courses ORDER BY created_at DESC`
    )
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar cursos' })
  }
})

// Buscar por slug (público)
router.get('/slug/:slug', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', p.id, 'name', p.name, 'bio', p.bio, 'photo', p.photo, 'linkedin', p.linkedin,
                'role', p.role, 'team_type', p.team_type,
                'specialties', (SELECT json_agg(ps.name) FROM professor_specialties ps WHERE ps.professor_id = p.id)
              )) FILTER (WHERE p.id IS NOT NULL), '[]') AS professors,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', cm.id, 'name', cm.name, 'workload', cm.workload, 'order_index', cm.order_index,
                'disciplines', (SELECT json_agg(cd.name ORDER BY cd.order_index) FROM course_disciplines cd WHERE cd.module_id = cm.id)
              )) FILTER (WHERE cm.id IS NOT NULL), '[]') AS modules,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', t.id, 'name', t.name, 'role', t.role, 'content', t.content, 'photo', t.photo
              )) FILTER (WHERE t.id IS NOT NULL AND t.active = true), '[]') AS testimonials
       FROM courses c
       LEFT JOIN course_professors cp ON cp.course_id = c.id
       LEFT JOIN professors p ON p.id = cp.professor_id AND p.active = true
       LEFT JOIN course_modules cm ON cm.course_id = c.id
       LEFT JOIN testimonials t ON t.course_id = c.id
       WHERE c.slug = $1 AND c.active = true
       GROUP BY c.id`,
      [req.params.slug]
    )
    if (!rows.length) return res.status(404).json({ error: 'Curso não encontrado' })
    const course = rows[0]
    course.modules = course.modules.sort((a, b) => a.order_index - b.order_index)

    // Seções extras
    const { rows: sections } = await pool.query(
      'SELECT id, title, content, image, order_index FROM course_extra_sections WHERE course_id = $1 ORDER BY order_index',
      [course.id]
    )
    course.extra_sections = sections

    // FAQs
    const { rows: faqs } = await pool.query(
      'SELECT id, question, answer, order_index FROM course_faqs WHERE course_id = $1 ORDER BY order_index',
      [course.id]
    )
    course.faqs = faqs

    // Cursos relacionados (mesma categoria) – link interno para SEO
    const { rows: related } = await pool.query(
      `SELECT ${LIST_FIELDS} FROM courses
       WHERE active = true AND category = $1 AND id <> $2
       ORDER BY featured DESC, created_at DESC LIMIT 3`,
      [course.category, course.id]
    )
    course.related = related

    // Campos internos da busca não vão para o site
    delete course.search_text; delete course.search_tsv; delete course.search_tsv_simple; delete course.search_title; delete course.search_disciplines

    res.json(course)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar curso' })
  }
})

// Buscar por ID (admin)
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT c.*,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', p.id, 'name', p.name, 'bio', p.bio, 'photo', p.photo, 'linkedin', p.linkedin,
                'role', p.role, 'team_type', p.team_type,
                'specialties', (SELECT json_agg(ps.name) FROM professor_specialties ps WHERE ps.professor_id = p.id)
              )) FILTER (WHERE p.id IS NOT NULL), '[]') AS professors,
              COALESCE(json_agg(DISTINCT jsonb_build_object(
                'id', cm.id, 'name', cm.name, 'workload', cm.workload, 'order_index', cm.order_index,
                'disciplines', (SELECT json_agg(jsonb_build_object('id', cd.id, 'name', cd.name, 'order_index', cd.order_index) ORDER BY cd.order_index) FROM course_disciplines cd WHERE cd.module_id = cm.id)
              )) FILTER (WHERE cm.id IS NOT NULL), '[]') AS modules
       FROM courses c
       LEFT JOIN course_professors cp ON cp.course_id = c.id
       LEFT JOIN professors p ON p.id = cp.professor_id
       LEFT JOIN course_modules cm ON cm.course_id = c.id
       WHERE c.id = $1
       GROUP BY c.id`,
      [req.params.id]
    )
    if (!rows.length) return res.status(404).json({ error: 'Curso não encontrado' })
    const course = rows[0]
    course.modules = course.modules.sort((a, b) => a.order_index - b.order_index)

    // Seções extras
    const { rows: sections } = await pool.query(
      'SELECT id, title, content, image, order_index FROM course_extra_sections WHERE course_id = $1 ORDER BY order_index',
      [course.id]
    )
    course.extra_sections = sections

    // FAQs
    const { rows: faqs } = await pool.query(
      'SELECT id, question, answer, order_index FROM course_faqs WHERE course_id = $1 ORDER BY order_index',
      [course.id]
    )
    course.faqs = faqs

    res.json(course)
  } catch (err) {
    res.status(500).json({ error: 'Erro ao buscar curso' })
  }
})

// Criar curso (admin)
router.post('/', requireAuth, async (req, res) => {
  try {
    const {
      title, subtitle, description, cover_image, workload, modality, duration, category,
      price_pix, price_installment, installments, installment_value,
      price_original, discount_percent,
      active, featured, vacancy_count, offer_expires_at, whatsapp_message, seo_title, seo_description,
      professors, modules, extra_sections, faqs
    } = req.body

    const slug = slugify(title, { lower: true, strict: true })

    const { rows } = await pool.query(
      `INSERT INTO courses (slug, title, subtitle, description, cover_image, workload, modality, duration, category,
                            price_pix, price_installment, installments, installment_value,
                            price_original, discount_percent,
                            active, featured, vacancy_count, offer_expires_at, whatsapp_message, seo_title, seo_description)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22) RETURNING *`,
      [slug, title, subtitle, description, cover_image, workload, modality, normalizeDuration(duration), category,
       price_pix, price_installment, installments, installment_value,
       price_original || 0, discount_percent || 0,
       active ?? true, featured ?? false, vacancy_count, offer_expires_at || null, whatsapp_message, seo_title, seo_description]
    )

    const course = rows[0]
    if (professors?.length) {
      for (const pid of professors) {
        await pool.query('INSERT INTO course_professors (course_id, professor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [course.id, pid])
      }
    }
    if (modules?.length) {
      await saveModules(course.id, modules)
    }
    if (extra_sections?.length) {
      await saveExtraSections(course.id, extra_sections)
    }
    if (faqs?.length) {
      await saveFaqs(course.id, faqs)
    }
    await refreshSearch(course.id)

    res.status(201).json(course)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao criar curso' })
  }
})

// Atualizar curso (admin)
router.put('/:id', requireAuth, async (req, res) => {
  try {
    const {
      title, subtitle, description, cover_image, workload, modality, duration, category,
      price_pix, price_installment, installments, installment_value,
      price_original, discount_percent,
      active, featured, vacancy_count, offer_expires_at, whatsapp_message, seo_title, seo_description,
      professors, modules, extra_sections, faqs
    } = req.body

    const id = req.params.id
    const { rows: existing } = await pool.query('SELECT slug FROM courses WHERE id = $1', [id])
    if (!existing.length) return res.status(404).json({ error: 'Curso não encontrado' })

    await pool.query(
      `UPDATE courses SET title=$1, subtitle=$2, description=$3, cover_image=$4, workload=$5, modality=$6,
                          duration=$7, category=$8, price_pix=$9, price_installment=$10, installments=$11,
                          installment_value=$12, price_original=$13, discount_percent=$14,
                          active=$15, featured=$16, vacancy_count=$17,
                          offer_expires_at=$18, whatsapp_message=$19, seo_title=$20, seo_description=$21
       WHERE id=$22`,
      [title, subtitle, description, cover_image, workload, modality, normalizeDuration(duration), category,
       price_pix, price_installment, installments, installment_value,
       price_original || 0, discount_percent || 0,
       active, featured, vacancy_count, offer_expires_at || null, whatsapp_message, seo_title, seo_description,
       id]
    )

    // Professores
    await pool.query('DELETE FROM course_professors WHERE course_id = $1', [id])
    if (professors?.length) {
      for (const pid of professors) {
        await pool.query('INSERT INTO course_professors (course_id, professor_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, pid])
      }
    }

    // Módulos
    if (modules !== undefined) {
      await pool.query('DELETE FROM course_modules WHERE course_id = $1', [id])
      if (modules?.length) await saveModules(id, modules)
    }

    // Seções extras
    await pool.query('DELETE FROM course_extra_sections WHERE course_id = $1', [id])
    if (extra_sections?.length) await saveExtraSections(id, extra_sections)

    // FAQs
    await pool.query('DELETE FROM course_faqs WHERE course_id = $1', [id])
    if (faqs?.length) await saveFaqs(id, faqs)
    await refreshSearch(id)

    const { rows } = await pool.query('SELECT * FROM courses WHERE id = $1', [id])
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar curso' })
  }
})

// Deletar curso (admin)
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query('DELETE FROM courses WHERE id = $1 RETURNING id', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Curso não encontrado' })
    res.json({ message: 'Curso deletado' })
  } catch (err) {
    res.status(500).json({ error: 'Erro ao deletar curso' })
  }
})

async function saveModules(courseId, modules) {
  for (let i = 0; i < modules.length; i++) {
    const mod = modules[i]
    const { rows } = await pool.query(
      'INSERT INTO course_modules (course_id, name, workload, order_index) VALUES ($1, $2, $3, $4) RETURNING id',
      [courseId, mod.name, mod.workload || 0, i]
    )
    const modId = rows[0].id
    if (mod.disciplines?.length) {
      for (let j = 0; j < mod.disciplines.length; j++) {
        const d = mod.disciplines[j]
        await pool.query(
          'INSERT INTO course_disciplines (module_id, name, order_index) VALUES ($1, $2, $3)',
          [modId, typeof d === 'string' ? d : d.name, j]
        )
      }
    }
  }
}

async function saveFaqs(courseId, faqs) {
  for (let i = 0; i < faqs.length; i++) {
    const f = faqs[i]
    await pool.query(
      'INSERT INTO course_faqs (course_id, question, answer, order_index) VALUES ($1, $2, $3, $4)',
      [courseId, f.question, f.answer || '', i]
    )
  }
}

async function saveExtraSections(courseId, sections) {
  for (let i = 0; i < sections.length; i++) {
    const s = sections[i]
    await pool.query(
      'INSERT INTO course_extra_sections (course_id, title, content, image, order_index) VALUES ($1, $2, $3, $4, $5)',
      [courseId, s.title, s.content || '', s.image || '', i]
    )
  }
}

module.exports = router
