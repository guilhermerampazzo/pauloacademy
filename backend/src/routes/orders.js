const router = require('express').Router()
const crypto = require('crypto')
const rateLimit = require('express-rate-limit')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')
const { priceCart } = require('../lib/pricing')
const { getWhatsAppNumber } = require('../lib/settings')
const { isValidCPF } = require('../lib/cpf')
const mp = require('../lib/mercadopago')

const METHODS = ['pix', 'boleto', 'credit_card']
const brl = n => Number(n).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

// Limita criação de pedidos por IP (evita spam de cobranças)
const orderLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.' },
})

// ---------------------------------------------------------------------------
// Admin: listagem com os itens de cada pedido
// ---------------------------------------------------------------------------
router.get('/', requireAuth, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT o.*, cp.code AS coupon_code,
              COALESCE(json_agg(json_build_object(
                'course_id', oi.course_id, 'course_title', oi.course_title,
                'unit_price', oi.unit_price, 'discount', oi.discount, 'final_price', oi.final_price
              ) ORDER BY oi.id) FILTER (WHERE oi.id IS NOT NULL), '[]') AS items
       FROM orders o
       LEFT JOIN coupons cp ON cp.id = o.coupon_id
       LEFT JOIN order_items oi ON oi.order_id = o.id
       GROUP BY o.id, cp.code
       ORDER BY o.created_at DESC`
    )
    // compatibilidade com a tela antiga: course_title = lista dos cursos
    rows.forEach(r => { r.course_title = r.items.map(i => i.course_title).join(' + ') })
    res.json(rows)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao buscar pedidos' })
  }
})

// ---------------------------------------------------------------------------
// Público: cotação do carrinho (preços sempre calculados no servidor)
// ---------------------------------------------------------------------------
router.post('/quote', async (req, res) => {
  try {
    const { course_ids, coupon_code, payment_method } = req.body || {}
    const method = METHODS.includes(payment_method) ? payment_method : 'pix'
    const quote = await priceCart(course_ids, coupon_code, method)
    res.json(quote)
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao calcular o carrinho' })
  }
})

// ---------------------------------------------------------------------------
// Público: criar pedido (1 ou vários cursos)
// ---------------------------------------------------------------------------
router.post('/', orderLimiter, async (req, res) => {
  const body = req.body || {}
  const customer = {
    name: String(body.customer_name || '').trim(),
    email: String(body.customer_email || '').trim().toLowerCase(),
    phone: String(body.customer_phone || '').trim(),
    cpf: String(body.customer_cpf || '').replace(/\D/g, ''),
  }
  const method = METHODS.includes(body.payment_method) ? body.payment_method : 'pix'

  // Aceita o formato novo (items / course_ids) e o antigo (course_id)
  let courseIds = []
  if (Array.isArray(body.items)) courseIds = body.items.map(i => (typeof i === 'object' ? i.course_id : i))
  else if (Array.isArray(body.course_ids)) courseIds = body.course_ids
  else if (body.course_id) courseIds = [body.course_id]

  if (customer.name.length < 3) return res.status(400).json({ error: 'Informe seu nome completo' })
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email)) return res.status(400).json({ error: 'E-mail inválido' })
  if (customer.phone.replace(/\D/g, '').length < 10) return res.status(400).json({ error: 'Telefone inválido' })
  if (method === 'boleto' && !isValidCPF(customer.cpf)) return res.status(400).json({ error: 'CPF inválido (obrigatório para boleto)' })
  if (customer.cpf && !isValidCPF(customer.cpf)) customer.cpf = ''

  let quote
  try {
    quote = await priceCart(courseIds, body.coupon_code, method)
  } catch (err) {
    console.error(err)
    return res.status(500).json({ error: 'Erro ao calcular o pedido' })
  }
  if (!quote.items.length) return res.status(400).json({ error: 'Nenhum curso disponível para compra no carrinho' })
  if (quote.total <= 0) return res.status(400).json({ error: 'Valor do pedido inválido' })

  const whatsappFallback = await buildWhatsApp(quote.items, customer.name, quote.total)

  // 1) Grava o pedido e os itens em transação
  const client = await pool.connect()
  let order
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO orders (course_id, coupon_id, customer_name, customer_email, customer_phone, customer_cpf,
                           amount, payment_method, status, access_token)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9) RETURNING *`,
      [quote.items[0].course_id, quote.coupon?.id || null, customer.name, customer.email, customer.phone,
       customer.cpf || null, quote.total.toFixed(2), method, crypto.randomBytes(24).toString('hex')]
    )
    order = rows[0]
    for (const it of quote.items) {
      await client.query(
        `INSERT INTO order_items (order_id, course_id, course_title, unit_price, discount, final_price)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [order.id, it.course_id, it.title, it.unit_price, it.discount, it.final_price]
      )
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    console.error(err)
    return res.status(500).json({ error: 'Erro ao criar pedido' })
  } finally {
    client.release()
  }

  const base = {
    order: { id: order.id, amount: Number(order.amount), status: order.status, access_token: order.access_token },
    items: quote.items,
    whatsapp_fallback: whatsappFallback,
  }

  // 2) Sem Mercado Pago configurado: segue pelo WhatsApp (comportamento anterior)
  if (!mp.isEnabled()) return res.status(201).json({ ...base, mode: 'whatsapp' })

  // 3) Cria a cobrança no Mercado Pago
  try {
    let payment = {}
    if (method === 'pix') {
      payment = await mp.createPix({ order, items: quote.items, customer })
    } else if (method === 'boleto') {
      payment = await mp.createBoleto({ order, items: quote.items, customer })
    } else {
      payment = await mp.createCardPreference({ order, items: quote.items, customer, maxInstallments: quote.maxInstallments })
    }
    await pool.query(
      `UPDATE orders SET payment_id = $1, mp_preference_id = $2, payment_url = $3 WHERE id = $4`,
      [payment.payment_id || null, payment.preference_id || null, payment.payment_url || payment.boleto_url || null, order.id]
    )
    return res.status(201).json({ ...base, mode: 'mercadopago', ...payment })
  } catch (err) {
    // Antes o erro era engolido e o cliente ia para o WhatsApp sem aviso.
    const detail = err?.cause?.[0]?.description || err?.message || String(err)
    console.error(`Erro Mercado Pago no pedido #${order.id}:`, detail)
    await pool.query(`UPDATE orders SET payment_error = $1, status = 'failed' WHERE id = $2`, [String(detail).slice(0, 1000), order.id])
    return res.status(502).json({
      ...base,
      mode: 'error',
      error: 'Não foi possível gerar o pagamento agora. Você pode tentar outra forma de pagamento ou concluir a matrícula pelo WhatsApp.',
    })
  }
})

// ---------------------------------------------------------------------------
// Público: status do pedido (a tela do PIX consulta a cada poucos segundos)
// Protegido pelo access_token do pedido, para não expor pedidos de terceiros.
// ---------------------------------------------------------------------------
router.get('/:id/public-status', async (req, res) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, status, amount, payment_method FROM orders WHERE id = $1 AND access_token = $2',
      [req.params.id, String(req.query.t || '')]
    )
    if (!rows.length) return res.status(404).json({ error: 'Pedido não encontrado' })
    res.json(rows[0])
  } catch {
    res.status(500).json({ error: 'Erro' })
  }
})

// ---------------------------------------------------------------------------
// Webhook do Mercado Pago
// Antes: qualquer POST {type:'payment', data:{id}} marcava o pedido como pago.
// Agora: (1) valida a assinatura quando MERCADOPAGO_WEBHOOK_SECRET existe;
// (2) consulta o pagamento na API do MP; (3) localiza o pedido pelo
// external_reference; (4) só marca "paid" com status approved e valor >= pedido.
// ---------------------------------------------------------------------------
router.post('/webhook/mercadopago', async (req, res) => {
  const type = req.query.type || req.query.topic || req.body?.type || req.body?.topic
  const dataId = req.query['data.id'] || req.body?.data?.id || (req.query.topic === 'payment' ? req.query.id : null)

  const signature = mp.verifySignature(req, dataId)
  if (signature === false) {
    console.warn('Webhook MP com assinatura inválida – ignorado')
    return res.sendStatus(401)
  }

  // Responde rápido; o MP reenvia se não receber 2xx
  if (type !== 'payment' || !dataId || !mp.isEnabled()) return res.sendStatus(200)

  try {
    await syncPayment(String(dataId))
    res.sendStatus(200)
  } catch (err) {
    console.error('Erro no webhook MP:', err?.message || err)
    res.sendStatus(500) // o MP tentará de novo
  }
})

async function syncPayment(paymentId) {
  const payment = await mp.getPayment(paymentId)
  const orderId = Number(payment.external_reference)

  let order
  if (orderId) {
    const r = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId])
    order = r.rows[0]
  }
  if (!order) {
    const r = await pool.query('SELECT * FROM orders WHERE payment_id = $1', [String(payment.id)])
    order = r.rows[0]
  }
  if (!order) {
    console.warn(`Webhook MP: pagamento ${payment.id} sem pedido correspondente`)
    return
  }

  const status = payment.status
  const paidAmount = Number(payment.transaction_amount || 0)
  let newStatus = null
  if (status === 'approved') {
    if (paidAmount + 0.01 >= Number(order.amount)) newStatus = 'paid'
    else console.warn(`Pedido #${order.id}: valor pago ${paidAmount} menor que ${order.amount}`)
  } else if (['rejected', 'cancelled'].includes(status)) newStatus = order.status === 'paid' ? null : 'failed'
  else if (['refunded', 'charged_back'].includes(status)) newStatus = 'refunded'

  await pool.query(
    `UPDATE orders SET payment_id = $1, payment_status_detail = $2 WHERE id = $3`,
    [String(payment.id), `${status}${payment.status_detail ? ':' + payment.status_detail : ''}`.slice(0, 100), order.id]
  )
  if (newStatus === 'paid') await markPaid(order.id)
  else if (newStatus) await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [newStatus, order.id])
}

// Marca como pago e conta o uso do cupom UMA vez (antes contava ao criar o pedido)
async function markPaid(orderId) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const { rows } = await client.query('SELECT * FROM orders WHERE id = $1 FOR UPDATE', [orderId])
    const order = rows[0]
    if (!order) { await client.query('ROLLBACK'); return }
    await client.query(`UPDATE orders SET status = 'paid', paid_at = COALESCE(paid_at, NOW()) WHERE id = $1`, [orderId])
    if (order.coupon_id && !order.coupon_counted) {
      await client.query('UPDATE coupons SET used_count = used_count + 1 WHERE id = $1', [order.coupon_id])
      await client.query('UPDATE orders SET coupon_counted = true WHERE id = $1', [orderId])
    }
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    throw err
  } finally {
    client.release()
  }
}

// Admin: alterar status manualmente
router.put('/:id/status', requireAuth, async (req, res) => {
  try {
    const { status } = req.body
    if (!['pending', 'paid', 'failed', 'refunded'].includes(status)) return res.status(400).json({ error: 'Status inválido' })
    if (status === 'paid') await markPaid(req.params.id)
    else await pool.query('UPDATE orders SET status = $1 WHERE id = $2', [status, req.params.id])
    const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [req.params.id])
    if (!rows.length) return res.status(404).json({ error: 'Pedido não encontrado' })
    res.json(rows[0])
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao atualizar pedido' })
  }
})

async function buildWhatsApp(items, customerName, amount) {
  const number = await getWhatsAppNumber()
  const cursos = items.map(i => `• ${i.title}`).join('\n')
  const msg = encodeURIComponent(
    `Olá! Meu nome é ${customerName} e gostaria de concluir minha matrícula:\n${cursos}\nTotal: ${brl(amount)}`
  )
  return number ? `https://wa.me/${number}?text=${msg}` : null
}

module.exports = router
module.exports.syncPayment = syncPayment
module.exports.markPaid = markPaid
