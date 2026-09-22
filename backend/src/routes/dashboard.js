const router = require('express').Router()
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')

router.get('/stats', requireAuth, async (req, res) => {
  try {
    const [courses, orders, professors, revenue] = await Promise.all([
      pool.query('SELECT COUNT(*) FROM courses WHERE active = true'),
      pool.query('SELECT COUNT(*), status FROM orders GROUP BY status'),
      pool.query('SELECT COUNT(*) FROM professors WHERE active = true'),
      pool.query(`SELECT COALESCE(SUM(amount), 0) AS total FROM orders WHERE status = 'paid'`),
    ])

    const orderStats = { total: 0, paid: 0, pending: 0 }
    orders.rows.forEach(r => {
      orderStats.total += parseInt(r.count)
      orderStats[r.status] = parseInt(r.count)
    })

    const recentOrders = await pool.query(
      `SELECT o.*, (SELECT string_agg(oi.course_title, ' + ' ORDER BY oi.id) FROM order_items oi WHERE oi.order_id = o.id) AS course_title
       FROM orders o
       ORDER BY o.created_at DESC LIMIT 10`
    )

    res.json({
      courses: parseInt(courses.rows[0].count),
      professors: parseInt(professors.rows[0].count),
      orders: orderStats,
      revenue: parseFloat(revenue.rows[0].total),
      recent_orders: recentOrders.rows,
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar estatísticas' })
  }
})

module.exports = router
