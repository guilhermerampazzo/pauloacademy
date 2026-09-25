// v2.4: envia a venda ao Google Analytics 4 pelo servidor (Measurement Protocol).
// Usado nas vendas confirmadas fora do site (parcelado TMB), onde o navegador do
// aluno não volta para a nossa página de sucesso.
// Precisa de: ID do GA4 em Conteúdo > Rastreamento e GA4_API_SECRET no .env
// (GA4 > Administrador > Fluxos de dados > [site] > Chaves secretas da API do Measurement Protocol).
const { pool } = require('../db')

async function measurementId() {
  try {
    const { rows } = await pool.query(`SELECT data->>'ga4_id' AS id FROM content_sections WHERE key = 'tracking'`)
    return (rows[0]?.id || '').trim()
  } catch { return '' }
}

async function sendPurchase(orderId, { paymentType = 'tmb' } = {}) {
  const secret = process.env.GA4_API_SECRET
  if (!secret) return { sent: false, reason: 'GA4_API_SECRET não configurada' }
  const mid = await measurementId()
  if (!mid) return { sent: false, reason: 'ID do GA4 não cadastrado' }

  const { rows } = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId])
  const order = rows[0]
  if (!order) return { sent: false, reason: 'pedido não encontrado' }
  if (order.ga_purchase_sent) return { sent: false, reason: 'já enviado' }
  const { rows: items } = await pool.query(
    `SELECT oi.course_id, oi.course_title, oi.final_price, c.category
     FROM order_items oi LEFT JOIN courses c ON c.id = oi.course_id WHERE oi.order_id = $1`, [orderId])

  // Sem o client_id do navegador a venda entra no GA4 como um usuário novo (sem a origem do tráfego)
  const clientId = order.ga_client_id || `${Math.floor(Math.random() * 1e9)}.${Math.floor(Date.now() / 1000)}`
  const body = {
    client_id: clientId,
    events: [{
      name: 'purchase',
      params: {
        transaction_id: String(order.id),
        currency: 'BRL',
        value: Number(order.amount),
        payment_type: paymentType,
        items: items.map(i => ({
          item_id: String(i.course_id || ''), item_name: i.course_title, item_category: i.category || undefined,
          price: Number(i.final_price), quantity: 1,
        })),
      },
    }],
  }
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(mid)}&api_secret=${encodeURIComponent(secret)}`
  const res = await fetch(url, { method: 'POST', body: JSON.stringify(body) })
  if (!res.ok) return { sent: false, reason: `GA4 ${res.status}` }
  await pool.query('UPDATE orders SET ga_purchase_sent = true WHERE id = $1', [orderId])
  return { sent: true }
}

module.exports = { sendPurchase }
