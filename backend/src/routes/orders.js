const router = require('express').Router()
const crypto = require('crypto')
const rateLimit = require('express-rate-limit')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')
const { priceCart } = require('../lib/pricing')
const { getWhatsAppNumber } = require('../lib/settings')
const { isValidCPF } = require('../lib/cpf')
const mp = require('../lib/mercadopago')
const tmb = require('../lib/tmb')
const ga4 = require('../lib/ga4')

// v2.4: 'tmb' = parcelado sem cartão (PIX ou boleto) pela TMB
const METHODS = ['pix', 'boleto', 'credit_card', 'tmb']
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
    // v2.4: informa se o parcelado sem cartão (TMB) vale para este carrinho
    try {
      const cfg = await tmb.getConfig()
      quote.tmb = tmb.availability(cfg, quote)
      // v2.4: simulação (entrada + parcelas) para a tabela do checkout
      if (quote.tmb.available) quote.tmb.simulacao = tmb.simulate(cfg.categories[quote.items[0].category], quote.items[0].final_price)
    } catch { quote.tmb = { available: false } }
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
  if (method === 'tmb') {
    const av = tmb.availability(await tmb.getConfig().catch(() => null), quote)
    if (!av.available) return res.status(400).json({ error: av.reason || 'Parcelado sem cartão indisponível para este curso. Escolha outra forma de pagamento.' })
  }
  const gaClientId = /^\d{3,12}\.\d{6,12}$/.test(String(body.ga_client_id || '')) ? String(body.ga_client_id) : null

  const whatsappFallback = await buildWhatsApp(quote.items, customer.name, quote.total)

  // 1) Grava o pedido e os itens em transação
  const client = await pool.connect()
  let order
  try {
    await client.query('BEGIN')
    const { rows } = await client.query(
      `INSERT INTO orders (course_id, coupon_id, customer_name, customer_email, customer_phone, customer_cpf,
                           amount, payment_method, status, access_token, ga_client_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,'pending',$9,$10) RETURNING *`,
      [quote.items[0].course_id, quote.coupon?.id || null, customer.name, customer.email, customer.phone,
       customer.cpf || null, quote.total.toFixed(2), method, crypto.randomBytes(24).toString('hex'), gaClientId]
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

  // 2) v2.4: parcelado sem cartão – link da oferta na TMB com as UTMs do pedido
  if (method === 'tmb') {
    try {
      const it = quote.items[0]
      const offer = await tmb.getOfferUrl({ category: it.category, price: it.final_price })
      const url = tmb.withUtm(offer.url, { orderId: order.id, slug: it.slug })
      await pool.query(`UPDATE orders SET payment_url = $1, payment_status_detail = $2 WHERE id = $3`,
        [url, `tmb:link_${offer.source}`, order.id])
      return res.status(201).json({ ...base, mode: 'tmb', payment_url: url })
    } catch (err) {
      const detail = err?.message || String(err)
      console.error(`Erro TMB no pedido #${order.id}:`, detail)
      await pool.query(`UPDATE orders SET payment_error = $1, status = 'failed' WHERE id = $2`, [String(detail).slice(0, 1000), order.id])
      return res.status(502).json({
        ...base,
        mode: 'error',
        error: 'Não foi possível abrir o parcelamento agora. Você pode tentar outra forma de pagamento ou concluir a matrícula pelo WhatsApp.',
      })
    }
  }

  // 3) Sem Mercado Pago configurado: segue pelo WhatsApp (comportamento anterior)
  if (!mp.isEnabled()) return res.status(201).json({ ...base, mode: 'whatsapp' })

  // 4) Cria a cobrança no Mercado Pago
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

// ---------------------------------------------------------------------------
// v2.4: Webhook da TMB (Vendas e Etapas do Checkout)
// Configurar na TMB: Produtos > [produto] > Integrações > Webhook Vendas (e, se quiser,
// Etapas do Checkout) com URL https://academypopeduca.com.br/api/orders/webhook/tmb,
// Chave = x-tmb-token e Valor = TMB_WEBHOOK_TOKEN do .env.
// Eventos: "Efetivado" (entrada paga) -> pedido pago; "Cancelado" -> reembolsado/falhou.
// A TMB pode mandar campos novos: tudo que não é usado é ignorado.
// ---------------------------------------------------------------------------
router.post('/webhook/tmb', async (req, res) => {
  if (!tmb.verifyWebhook(req)) {
    console.warn('Webhook TMB sem token válido – ignorado')
    return res.status(401).json({ error: 'token inválido' })
  }
  const p = req.body || {}
  try {
    const result = await handleTmbEvent(p)
    res.json({ ok: true, ...result })
  } catch (err) {
    console.error('Erro no webhook TMB:', err?.message || err)
    res.status(500).json({ error: 'erro ao processar' }) // aparece como erro no histórico da TMB (dá para reenviar)
  }
})

async function handleTmbEvent(p) {
  const status = String(p.status_pedido || '').trim().toLowerCase()
  const fase = String(p.fase_checkout || p.status_checkout || '').trim()
  const tmbPedido = Number(p.pedido || p.pedido_id || 0) || null

  // 1) Acha o pedido do site: UTM pedido-<id>, depois nº do pedido TMB, depois e-mail
  let order = null
  const oid = tmb.orderIdFromPayload(p)
  if (oid) order = (await pool.query(`SELECT * FROM orders WHERE id = $1 AND payment_method = 'tmb'`, [oid])).rows[0]
  if (!order && tmbPedido) order = (await pool.query(`SELECT * FROM orders WHERE tmb_order_id = $1`, [tmbPedido])).rows[0]
  if (!order && p.email) {
    order = (await pool.query(
      `SELECT * FROM orders WHERE payment_method = 'tmb' AND lower(customer_email) = lower($1)
         AND created_at > NOW() - INTERVAL '30 days' AND tmb_order_id IS NULL
       ORDER BY created_at DESC LIMIT 1`, [String(p.email)])).rows[0]
  }

  await pool.query(
    `INSERT INTO tmb_events (order_id, tmb_order_id, status_pedido, fase_checkout, payload) VALUES ($1,$2,$3,$4,$5)`,
    [order?.id || null, tmbPedido, status || null, fase || null, JSON.stringify(p).slice(0, 100000)]
  )
  if (!order) {
    console.warn(`Webhook TMB: pedido TMB ${tmbPedido} sem pedido correspondente no site`)
    return { matched: false }
  }

  await pool.query(
    `UPDATE orders SET tmb_order_id = COALESCE($1, tmb_order_id), tmb_status = COALESCE($2, tmb_status),
            tmb_phase = COALESCE($3, tmb_phase), payment_id = COALESCE(payment_id, $4) WHERE id = $5`,
    [tmbPedido, status || null, fase || null, tmbPedido ? `tmb-${tmbPedido}` : null, order.id]
  )

  if (fase && !status) {
    await pool.query(`UPDATE orders SET payment_status_detail = $1 WHERE id = $2`, [`tmb:${fase}`.slice(0, 100), order.id])
    return { matched: true, order_id: order.id, fase }
  }

  if (status === 'efetivado') {
    const valor = Number(p.valor_principal || 0)
    if (valor && valor + 0.01 < Number(order.amount)) {
      await pool.query(`UPDATE orders SET payment_error = $1 WHERE id = $2`,
        [`TMB efetivou com valor ${valor} menor que o pedido ${order.amount}. Confira antes de liberar.`, order.id])
      return { matched: true, order_id: order.id, paid: false }
    }
    await pool.query(`UPDATE orders SET payment_status_detail = 'tmb:efetivado', payment_error = NULL WHERE id = $1`, [order.id])
    await markPaid(order.id)
    ga4.sendPurchase(order.id, { paymentType: 'tmb' }).catch(e => console.error('GA4 MP:', e.message))
    return { matched: true, order_id: order.id, paid: true }
  }
  if (status === 'cancelado') {
    await pool.query(`UPDATE orders SET status = CASE WHEN status = 'paid' THEN 'refunded' ELSE 'failed' END,
                        payment_status_detail = 'tmb:cancelado' WHERE id = $1`, [order.id])
    return { matched: true, order_id: order.id, cancelled: true }
  }
  if (status) await pool.query(`UPDATE orders SET payment_status_detail = $1 WHERE id = $2`, [`tmb:${status}`.slice(0, 100), order.id])
  return { matched: true, order_id: order.id }
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
module.exports.handleTmbEvent = handleTmbEvent
