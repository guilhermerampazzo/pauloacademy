// Testes do checkout (carrinho, cupom, webhook) com o Mercado Pago SIMULADO.
// Rodar contra um banco de TESTE (nunca o de produção):
//   DATABASE_URL=postgresql://user:senha@localhost:5432/academypop_teste JWT_SECRET=qualquer-coisa-com-32-caracteres npm test
// O script cria cursos/cupons temporários e remove tudo no final.
process.env.MERCADOPAGO_ACCESS_TOKEN = 'TEST'
process.env.MERCADOPAGO_WEBHOOK_SECRET = 'segredo'
const path = require('path').join(__dirname, '../src/')
const crypto = require('crypto')
const mpPath = require.resolve(path + 'lib/mercadopago.js')
const real = require(mpPath)
const payments = {}
let nextId = 1000
require.cache[mpPath].exports = {
  ...real,
  isEnabled: () => true,
  createPix: async ({ order }) => { const id = String(nextId++); payments[id] = { id, status: 'pending', transaction_amount: Number(order.amount), external_reference: String(order.id) }; return { payment_id: id, pix_qr_code: 'PIXCODE', pix_qr_code_base64: 'AAA' } },
  createBoleto: async ({ order }) => { const id = String(nextId++); payments[id] = { id, status: 'pending', transaction_amount: Number(order.amount), external_reference: String(order.id) }; return { payment_id: id, boleto_url: 'http://b', boleto_barcode: '123' } },
  createCardPreference: async ({ order, items, maxInstallments }) => ({ preference_id: 'pref-' + order.id, payment_url: 'http://mp/checkout', _items: items.length, maxInstallments }),
  getPayment: async id => { if (!payments[id]) throw new Error('not found'); return payments[id] },
}
const { app, bootTasks } = require(path + 'index.js')
const { pool, initDb } = require(path + 'db')
const assert = require('assert')

function sign(dataId, reqId = 'req-1') {
  const ts = String(Date.now())
  const v1 = crypto.createHmac('sha256', 'segredo').update(`id:${dataId};request-id:${reqId};ts:${ts};`).digest('hex')
  return { 'x-signature': `ts=${ts},v1=${v1}`, 'x-request-id': reqId }
}

;(async () => {
  await initDb(); await bootTasks()
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`
  const j = async (method, url, body, headers = {}) => {
    const r = await fetch(B + url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
    let data = null; try { data = await r.json() } catch {}
    return { status: r.status, data }
  }
  // cursos temporários
  await cleanup()
  const mk = (i, price, active = true) => pool.query(
    `INSERT INTO courses (slug, title, category, price_pix, price_installment, installments, installment_value, active)
     VALUES ($1, $2, 'Pós-Graduação', $3::numeric, $3::numeric, 12, round($3::numeric / 12, 2), $4) RETURNING id, price_pix`, [`teste-auto-${i}`, `Curso Teste Automatizado ${i}`, price, active])
  const cs = []
  for (let i = 1; i <= 3; i++) cs.push((await mk(i, 900 + i * 100)).rows[0])
  const inactive = [(await mk(4, 500, false)).rows[0]]
  await pool.query('SELECT refresh_course_search(NULL)')
  await pool.query("DELETE FROM coupons WHERE code IN ('TESTE10','CURSO1')")
  const { rows: [cp] } = await pool.query("INSERT INTO coupons (code, discount_percent, max_uses, active) VALUES ('TESTE10', 10, 1, true) RETURNING *")
  await pool.query("INSERT INTO coupons (code, discount_percent, course_id, active) VALUES ('CURSO1', 50, $1, true)", [cs[1].id])

  // 1. Cotação: 3 cursos + inativo + duplicado, cupom 10%
  let r = await j('POST', '/orders/quote', { course_ids: [cs[0].id, cs[1].id, cs[2].id, cs[0].id, inactive[0].id], coupon_code: 'teste10' })
  assert.equal(r.status, 200); assert.equal(r.data.items.length, 3); assert.equal(r.data.unavailable.length, 1)
  const sub = cs.reduce((s, c) => s + Number(c.price_pix), 0)
  assert.equal(r.data.subtotal, sub); assert.equal(r.data.total, Math.round(sub * 0.9 * 100) / 100)
  console.log('✓ cotação com cupom e curso inativo', r.data.total)

  // 2. Cupom de outro curso: só aplica no curso certo
  r = await j('POST', '/orders/quote', { course_ids: [cs[0].id, cs[1].id], coupon_code: 'CURSO1' })
  assert.equal(r.data.discount, Number(cs[1].price_pix) * 0.5)
  r = await j('POST', '/orders/quote', { course_ids: [cs[0].id], coupon_code: 'CURSO1' })
  assert.ok(r.data.couponError); assert.equal(r.data.discount, 0)
  console.log('✓ cupom restrito a um curso')

  // 3. Validações
  r = await j('POST', '/orders', { course_ids: [cs[0].id], customer_name: 'A', customer_email: 'x@y.com', customer_phone: '61999999999' })
  assert.equal(r.status, 400)
  r = await j('POST', '/orders', { course_ids: [cs[0].id], customer_name: 'Ana Souza', customer_email: 'ana@y.com', customer_phone: '61999999999', payment_method: 'boleto', customer_cpf: '111.111.111-11' })
  assert.equal(r.status, 400)
  console.log('✓ validação de nome e CPF')

  // 4. Pedido PIX com 2 cursos e cupom
  r = await j('POST', '/orders', { items: [{ course_id: cs[0].id }, { course_id: cs[1].id }], coupon_code: 'TESTE10', customer_name: 'Ana Souza', customer_email: 'ana@y.com', customer_phone: '61999999999', payment_method: 'pix' })
  assert.equal(r.status, 201, JSON.stringify(r.data)); assert.equal(r.data.pix_qr_code, 'PIXCODE')
  const order = r.data.order
  const { rows: items } = await pool.query('SELECT * FROM order_items WHERE order_id = $1', [order.id])
  assert.equal(items.length, 2)
  let { rows: [c1] } = await pool.query('SELECT used_count FROM coupons WHERE id = $1', [cp.id])
  assert.equal(c1.used_count, 0)
  console.log('✓ pedido PIX com 2 itens; cupom ainda não contado')

  const payId = (await pool.query('SELECT payment_id FROM orders WHERE id=$1', [order.id])).rows[0].payment_id

  // 5. Webhook forjado (sem assinatura) -> 401, pedido continua pendente
  r = await j('POST', `/orders/webhook/mercadopago?data.id=${payId}&type=payment`, { type: 'payment', data: { id: payId } })
  assert.equal(r.status, 401)
  // 6. Webhook assinado mas pagamento ainda pendente -> continua pendente
  r = await j('POST', `/orders/webhook/mercadopago?data.id=${payId}&type=payment`, { type: 'payment', data: { id: payId } }, sign(payId))
  assert.equal(r.status, 200)
  let st = (await pool.query('SELECT status FROM orders WHERE id=$1', [order.id])).rows[0].status
  assert.equal(st, 'pending')
  console.log('✓ webhook sem assinatura rejeitado; PIX pendente não vira pago')

  // 7. Pago com valor menor -> não aprova
  payments[payId].status = 'approved'; payments[payId].transaction_amount = 1
  await j('POST', `/orders/webhook/mercadopago?data.id=${payId}&type=payment`, {}, sign(payId))
  st = (await pool.query('SELECT status FROM orders WHERE id=$1', [order.id])).rows[0].status
  assert.equal(st, 'pending')
  // 8. Aprovado com valor correto -> pago, cupom contado uma vez (mesmo com webhook repetido)
  payments[payId].transaction_amount = order.amount
  await j('POST', `/orders/webhook/mercadopago?data.id=${payId}&type=payment`, {}, sign(payId))
  await j('POST', `/orders/webhook/mercadopago?data.id=${payId}&type=payment`, {}, sign(payId))
  const o = (await pool.query('SELECT status, paid_at, coupon_counted FROM orders WHERE id=$1', [order.id])).rows[0]
  assert.equal(o.status, 'paid'); assert.ok(o.paid_at)
  c1 = (await pool.query('SELECT used_count FROM coupons WHERE id = $1', [cp.id])).rows[0]
  assert.equal(c1.used_count, 1)
  console.log('✓ valor divergente bloqueado; aprovado vira pago; cupom contado 1x')

  // 9. Status público exige token
  r = await j('GET', `/orders/${order.id}/public-status?t=errado`); assert.equal(r.status, 404)
  r = await j('GET', `/orders/${order.id}/public-status?t=${order.access_token}`); assert.equal(r.data.status, 'paid')
  console.log('✓ status público protegido por token')

  // 10. Cupom esgotado (max_uses 1) não vale mais
  r = await j('POST', '/orders/quote', { course_ids: [cs[0].id], coupon_code: 'TESTE10' })
  assert.ok(r.data.couponError)
  console.log('✓ cupom esgotado após pagamento aprovado')

  // 11. Cartão: preferência com vários itens
  r = await j('POST', '/orders', { course_ids: [cs[0].id, cs[2].id], customer_name: 'Bruno Lima', customer_email: 'b@y.com', customer_phone: '61988887777', payment_method: 'credit_card' })
  assert.equal(r.status, 201); assert.equal(r.data.payment_url, 'http://mp/checkout'); assert.equal(r.data._items, 2)
  // pagamento do cartão chega pelo webhook com external_reference = id do pedido
  payments['9999'] = { id: '9999', status: 'approved', transaction_amount: r.data.order.amount, external_reference: String(r.data.order.id) }
  await j('POST', `/orders/webhook/mercadopago?data.id=9999&type=payment`, {}, sign('9999'))
  st = (await pool.query('SELECT status, payment_id FROM orders WHERE id=$1', [r.data.order.id])).rows[0]
  assert.equal(st.status, 'paid'); assert.equal(st.payment_id, '9999')
  console.log('✓ cartão (Checkout Pro) confirmado pelo external_reference')

  // 12. Formato antigo (course_id) continua aceito
  r = await j('POST', '/orders', { course_id: cs[2].id, customer_name: 'Carla Dias', customer_email: 'c@y.com', customer_phone: '61977776666', payment_method: 'boleto', customer_cpf: '529.982.247-25' })
  assert.equal(r.status, 201); assert.equal(r.data.boleto_barcode, '123')
  console.log('✓ formato antigo (course_id) + boleto com CPF válido')

  // 13. Admin lista pedidos com itens
  const jwt = require('jsonwebtoken')
  const token = jwt.sign({ id: 1 }, process.env.JWT_SECRET)
  r = await j('GET', '/orders', null, { authorization: 'Bearer ' + token })
  assert.ok(r.data[0].items.length >= 1); assert.ok(r.data.some(x => x.course_title.includes(' + ')))
  console.log('✓ admin: pedidos com itens')

  // 14. Rotas novas
  r = await j('GET', '/courses/categories'); assert.ok(r.data.length >= 1)
  r = await j('GET', '/search?q=automatizad'); assert.ok(r.data.total >= 3, 'busca por prefixo')
  r = await j('GET', '/search?q=automatisado'); assert.ok(r.data.total >= 1 && r.data.fuzzy, 'busca com erro de digitação')
  console.log('✓ busca (prefixo e tolerância a erro)')
  r = await j('GET', '/courses?per_category=6'); const byCat = {}; r.data.forEach(c => byCat[c.category] = (byCat[c.category] || 0) + 1)
  assert.ok(Object.values(byCat).every(n => n <= 6))
  r = await j('GET', '/courses/sitemap'); assert.ok(r.data.length >= 3)
  r = await j('GET', '/content/testimonials/public'); assert.equal(r.status, 200)
  console.log('✓ categorias, home enxuta (≤6 por categoria), sitemap, depoimentos')

  srv.close(); await cleanup(); await pool.end(); console.log('\nTODOS OS TESTES PASSARAM')
})().catch(async e => { console.error('FALHOU:', e); await cleanup().catch(() => {}); process.exit(1) })

async function cleanup() {
  await pool.query(`DELETE FROM orders WHERE id IN (SELECT order_id FROM order_items oi JOIN courses c ON c.id = oi.course_id WHERE c.slug LIKE 'teste-auto-%')`)
  await pool.query(`DELETE FROM orders WHERE customer_email IN ('ana@y.com','b@y.com','c@y.com')`)
  await pool.query(`DELETE FROM coupons WHERE code IN ('TESTE10','CURSO1')`)
  await pool.query(`DELETE FROM courses WHERE slug LIKE 'teste-auto-%'`)
}
