// v2.4: testes do parcelado TMB (API simulada), webhook, blog agendado e migração da categoria EJA.
// Rodar contra um banco de TESTE (nunca o de produção):
//   DATABASE_URL=postgresql://user:senha@localhost:5432/academypop_teste JWT_SECRET=<32+ caracteres> npm run test:v24
process.env.TMB_API_TOKEN = 'token-de-teste'
process.env.TMB_WEBHOOK_TOKEN = 'segredo-webhook'
process.env.APP_URL = 'https://teste.local'
const src = require('path').join(__dirname, '../src/')
const assert = require('assert')

// Simula a API da TMB (qualquer outra chamada vai para o fetch real, ex.: servidor de teste local)
const realFetch = global.fetch
const tmbCalls = []
global.fetch = async (url, opts = {}) => {
  const u = String(url)
  if (u.startsWith('https://api.tmbeducacao.com.br')) {
    tmbCalls.push({ url: u, method: opts.method || 'GET', body: opts.body ? JSON.parse(opts.body) : null, auth: opts.headers?.Authorization })
    if (u.endsWith('/api/produtos')) return new Response(JSON.stringify([{ produto_id: 38494, produto_nome: 'Pós LA', ativo: true }]), { status: 200 })
    if (u.endsWith('/api/ofertas')) {
      const b = JSON.parse(opts.body)
      if (b.valor_principal < 144) return new Response(JSON.stringify({ message: 'valor mínimo' }), { status: 400 })
      return new Response(JSON.stringify({ status: 'Oferta criada com sucesso', url: `https://pay.tmbeducacao.com.br/tmb/OF${tmbCalls.length}` }), { status: 200 })
    }
    return new Response('not found', { status: 404 })
  }
  return realFetch(url, opts)
}

const { app, bootTasks } = require(src + 'index.js')
const { pool, initDb } = require(src + 'db')

;(async () => {
  await initDb(); await bootTasks()
  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`
  const j = async (method, url, body, headers = {}) => {
    const r = await realFetch(B + url, { method, headers: { 'content-type': 'application/json', ...headers }, body: body ? JSON.stringify(body) : undefined })
    let data = null; try { data = await r.json() } catch {}
    return { status: r.status, data }
  }
  const jwt = require('jsonwebtoken')
  const admin = (await pool.query('SELECT id, token_version FROM users ORDER BY id LIMIT 1')).rows[0]
  const auth = { authorization: 'Bearer ' + jwt.sign({ id: admin.id, tv: admin.token_version }, process.env.JWT_SECRET) }
  await cleanup()

  const mk = (slug, category, price) => pool.query(
    `INSERT INTO courses (slug, title, category, price_pix, price_installment, installments, installment_value, active)
     VALUES ($1, $2, $3, $4::numeric, $4::numeric, 12, round($4::numeric / 12, 2), true) RETURNING *`, [slug, `Curso ${slug}`, category, price])
  const pos1 = (await mk('teste-v24-pos1', 'Pós-Graduação', 999)).rows[0]
  const pos2 = (await mk('teste-v24-pos2', 'Pós-Graduação', 999)).rows[0]
  const barato = (await mk('teste-v24-barato', 'Pós-Graduação', 100)).rows[0]
  const tec = (await mk('teste-v24-tec', 'Técnico', 1188)).rows[0]

  // 1. Migração da categoria EJA (roda a cada boot, idempotente)
  await pool.query(`INSERT INTO courses (slug, title, category, price_pix, active) VALUES
    ('teste-v24-eja-f', 'EJA Ensino Fundamental EAD', 'EJA', 996, true),
    ('teste-v24-eja-m', 'EJA Ensino Médio EAD', 'EJA', 1170, true),
    ('teste-v24-eja-fm', 'EJA Fundamental e Médio EAD', 'EJA', 1428, true)`)
  await pool.query(`INSERT INTO blog_posts (slug, title, related_category, published) VALUES ('teste-v24-post-eja', 'Post EJA', 'EJA', false)`)
  await initDb()
  const cats = Object.fromEntries((await pool.query(`SELECT slug, category FROM courses WHERE slug LIKE 'teste-v24-eja-%'`)).rows.map(r => [r.slug, r.category]))
  assert.equal(cats['teste-v24-eja-f'], 'EJA Ensino Fundamental')
  assert.equal(cats['teste-v24-eja-m'], 'EJA Ensino Médio')
  assert.equal(cats['teste-v24-eja-fm'], 'EJA Ensino Médio')
  assert.equal((await pool.query(`SELECT related_category FROM blog_posts WHERE slug = 'teste-v24-post-eja'`)).rows[0].related_category, 'EJA Ensino Médio')
  await initDb() // segunda vez não muda nada
  console.log('✓ migração EJA -> EJA Ensino Fundamental / EJA Ensino Médio (idempotente)')

  // 1-b. Migração única: Tecnólogo/Superior Sequencial com cartão = PIX em 12x sem juros
  await pool.query(`DELETE FROM app_settings WHERE key = 'migracao_v24_parcela_sem_juros'`)
  const tecno = (await pool.query(`INSERT INTO courses (slug, title, category, price_pix, price_installment, installments, installment_value, active)
    VALUES ('teste-v24-tecno', 'Tecnólogo Teste', 'Tecnólogo', 2990, 2998.08, 12, 249.84, true) RETURNING id`)).rows[0]
  const posJ = (await pool.query(`INSERT INTO courses (slug, title, category, price_pix, price_installment, installments, installment_value, active)
    VALUES ('teste-v24-posj', 'Pós com juros', 'Pós-Graduação', 1350, 1548, 12, 129, true) RETURNING id`)).rows[0]
  await initDb()
  let c1 = (await pool.query('SELECT price_installment, installment_value FROM courses WHERE id = $1', [tecno.id])).rows[0]
  assert.equal(Number(c1.price_installment), 2990); assert.equal(Number(c1.installment_value), 249.17)
  assert.equal(Number((await pool.query('SELECT price_installment FROM courses WHERE id = $1', [posJ.id])).rows[0].price_installment), 1548, 'outras categorias não mudam')
  await pool.query('UPDATE courses SET price_installment = 3100, installment_value = 258.33 WHERE id = $1', [tecno.id])
  await initDb()
  c1 = (await pool.query('SELECT price_installment FROM courses WHERE id = $1', [tecno.id])).rows[0]
  assert.equal(Number(c1.price_installment), 3100, 'roda uma vez só: mudança feita depois no admin é mantida')
  console.log('✓ migração única: Tecnólogo/Superior Sequencial em 12x sem juros (R$ 249,17); outras categorias intactas')

  // 2. TMB desligada: quote sem opção, público sem categorias, pedido 'tmb' recusado
  let r = await j('POST', '/orders/quote', { course_ids: [pos1.id] })
  assert.equal(r.data.tmb.available, false)
  r = await j('GET', '/tmb/public'); assert.equal(r.data.enabled, false)
  r = await j('POST', '/orders', { course_ids: [pos1.id], customer_name: 'Ana Souza', customer_email: 'tmb1@y.com', customer_phone: '61999999999', payment_method: 'tmb' })
  assert.equal(r.status, 400)
  console.log('✓ TMB desligada: sem opção no checkout e pedido recusado')

  // 3. Configuração pelo admin (exige login) e dados públicos sem segredos
  r = await j('PUT', '/tmb/config', { enabled: true, categories: {} }); assert.equal(r.status, 401)
  r = await j('PUT', '/tmb/config', { enabled: true, categories: {
    'Pós-Graduação': { active: true, produto_id: '38494', qtd_parcelas: '24' },
    'Técnico': { active: true, link_manual: 'https://pay.tmb.com.br/ACADEMYPOPMU/FIXO', link_manual_valor: '1188' },
  } }, auth)
  assert.equal(r.status, 200); assert.equal(r.data.config.categories['Pós-Graduação'].produto_id, 38494)
  r = await j('GET', '/tmb/public')
  assert.equal(r.data.enabled, true)
  assert.deepEqual(Object.keys(r.data.categories).sort(), ['Pós-Graduação', 'Técnico'])
  assert.ok(!JSON.stringify(r.data).includes('38494') && !JSON.stringify(r.data).includes('pay.tmb'), 'público não expõe produto nem link')
  r = await j('GET', '/content'); assert.ok(!('tmb' in r.data), 'config da TMB fora do /content público')
  r = await j('GET', '/tmb/config', null, auth)
  assert.equal(r.data.status.api_token, true); assert.equal(r.data.status.webhook_url, 'https://teste.local/api/orders/webhook/tmb')
  r = await j('GET', '/tmb/produtos', null, auth); assert.equal(r.data[0].produto_id, 38494)
  console.log('✓ configuração no admin; /tmb/public e /content não expõem token, produto nem link')

  // 4. Regras de disponibilidade
  r = await j('POST', '/orders/quote', { course_ids: [pos1.id] }); assert.equal(r.data.tmb.available, true); assert.equal(r.data.tmb.max_parcelas, 24)
  // simulação padrão: entrada 10%, taxa de juros do financiamento 3,49% a.m., todos os planos de 3x até o máximo (24)
  assert.equal(r.data.tmb.simulacao.entrada, 99.9); assert.equal(r.data.tmb.simulacao.juros_mes, 3.49)
  assert.deepEqual(r.data.tmb.simulacao.opcoes.map(o => o.parcelas), Array.from({ length: 22 }, (_, k) => 3 + k))
  assert.equal(r.data.tmb.simulacao.opcoes[0].valor, 320.86)
  assert.equal(r.data.tmb.simulacao.opcoes.find(o => o.parcelas === 12).valor, 92.99)
  r = await j('GET', '/tmb/public'); assert.equal(r.data.categories['Pós-Graduação'].juros_mes, 3.49); assert.equal(r.data.categories['Pós-Graduação'].entrada_valor, 10); assert.equal(r.data.categories['Pós-Graduação'].parcela_minima, 3)
  r = await j('POST', '/orders/quote', { course_ids: [pos1.id, tec.id] }); assert.equal(r.data.tmb.available, false); assert.match(r.data.tmb.reason, /1 curso/)
  await pool.query("INSERT INTO coupons (code, discount_percent, active) VALUES ('TESTEV24', 10, true)")
  r = await j('POST', '/orders/quote', { course_ids: [pos1.id], coupon_code: 'TESTEV24' }); assert.equal(r.data.tmb.available, false); assert.match(r.data.tmb.reason, /cupom/)
  r = await j('POST', '/orders/quote', { course_ids: [barato.id] }); assert.equal(r.data.tmb.available, false) // abaixo de R$ 144
  r = await j('POST', '/orders', { course_ids: [pos1.id, tec.id], customer_name: 'Ana Souza', customer_email: 'tmb1@y.com', customer_phone: '61999999999', payment_method: 'tmb' })
  assert.equal(r.status, 400)
  console.log('✓ disponível só para 1 curso, sem cupom e a partir de R$ 144')

  // 5. Pedido TMB via API: cria a oferta, acrescenta UTMs; segundo curso com o mesmo preço reaproveita a oferta
  r = await j('POST', '/orders', { course_ids: [pos1.id], customer_name: 'Ana Souza', customer_email: 'tmb1@y.com', customer_phone: '61999999999', payment_method: 'tmb', ga_client_id: '123456789.1790000000' })
  assert.equal(r.status, 201); assert.equal(r.data.mode, 'tmb')
  const o1 = r.data.order
  const u1 = new URL(r.data.payment_url)
  assert.equal(u1.searchParams.get('utm_content'), `pedido-${o1.id}`)
  assert.equal(u1.searchParams.get('utm_campaign'), 'teste-v24-pos1')
  const posted = tmbCalls.filter(c => c.url.endsWith('/api/ofertas'))
  assert.equal(posted.length, 1); assert.equal(posted[0].body.valor_principal, 999); assert.equal(posted[0].body.qtd_parcelas, '24'); assert.equal(posted[0].body.produto_id, 38494)
  assert.equal(posted[0].auth, 'Bearer token-de-teste')
  assert.equal(posted[0].body.valor_boleto_entrada, 99.9, 'entrada da página enviada à TMB')
  r = await j('POST', '/orders', { course_ids: [pos2.id], customer_name: 'Bruno Lima', customer_email: 'tmb2@y.com', customer_phone: '61999999999', payment_method: 'tmb' })
  assert.equal(tmbCalls.filter(c => c.url.endsWith('/api/ofertas')).length, 1, 'mesmo preço reaproveita a oferta')
  const o2 = r.data.order
  const saved = (await pool.query('SELECT * FROM orders WHERE id = $1', [o1.id])).rows[0]
  assert.equal(saved.payment_method, 'tmb'); assert.equal(saved.status, 'pending'); assert.equal(saved.ga_client_id, '123456789.1790000000')
  console.log('✓ pedido TMB: oferta criada pela API no preço do curso, UTMs do pedido, oferta reaproveitada')

  // 6. Link fixo (Técnico, sem produto): usa o link quando o preço bate
  r = await j('POST', '/orders', { course_ids: [tec.id], customer_name: 'Carla Dias', customer_email: 'tmb3@y.com', customer_phone: '61999999999', payment_method: 'tmb' })
  assert.equal(r.data.mode, 'tmb'); assert.ok(r.data.payment_url.startsWith('https://pay.tmb.com.br/ACADEMYPOPMU/FIXO?'))
  const o3 = r.data.order
  console.log('✓ link fixo usado quando não há produto/API e o preço bate')

  // 7. Webhook: token obrigatório
  const wh = (body, token = 'segredo-webhook') => j('POST', '/orders/webhook/tmb', body, token ? { 'x-tmb-token': token } : {})
  r = await wh({ status_pedido: 'Efetivado', utm_content: `pedido-${o1.id}` }, null); assert.equal(r.status, 401)
  r = await wh({ status_pedido: 'Efetivado', utm_content: `pedido-${o1.id}` }, 'errado'); assert.equal(r.status, 401)
  assert.equal((await pool.query('SELECT status FROM orders WHERE id = $1', [o1.id])).rows[0].status, 'pending')
  console.log('✓ webhook sem o token certo é recusado e não muda o pedido')

  // 8. Etapa do checkout -> só registra a fase
  r = await wh({ pedido: 555001, fase_checkout: 'Aguardando Pagamento', utm_content: `pedido-${o1.id}`, email: 'tmb1@y.com', campo_novo_qualquer: { x: 1 } })
  assert.equal(r.status, 200)
  let row = (await pool.query('SELECT * FROM orders WHERE id = $1', [o1.id])).rows[0]
  assert.equal(row.status, 'pending'); assert.equal(row.tmb_phase, 'Aguardando Pagamento'); assert.equal(row.tmb_order_id, 555001)
  console.log('✓ etapa do checkout registrada (campos novos da TMB são ignorados)')

  // 9. Efetivado com valor menor não libera; efetivado correto marca pago
  r = await wh({ pedido: 555001, status_pedido: 'Efetivado', valor_principal: 500, utm_content: `pedido-${o1.id}` })
  row = (await pool.query('SELECT * FROM orders WHERE id = $1', [o1.id])).rows[0]
  assert.equal(row.status, 'pending'); assert.match(row.payment_error, /menor/)
  r = await wh({ pedido: 555001, status_pedido: 'Efetivado', valor_principal: 999, utm_content: `pedido-${o1.id}` })
  row = (await pool.query('SELECT * FROM orders WHERE id = $1', [o1.id])).rows[0]
  assert.equal(row.status, 'paid'); assert.ok(row.paid_at); assert.equal(row.payment_error, null); assert.equal(row.payment_id, 'tmb-555001')
  console.log('✓ "Efetivado" marca o pedido como pago (valor menor fica bloqueado)')

  // 10. Sem UTM: acha pelo nº do pedido TMB ou pelo e-mail
  r = await wh({ pedido: 555002, status_pedido: 'Efetivado', valor_principal: 999, email: 'TMB2@y.com' })
  assert.equal(r.data.order_id, o2.id)
  assert.equal((await pool.query('SELECT status FROM orders WHERE id = $1', [o2.id])).rows[0].status, 'paid')
  r = await wh({ pedido: 999999, status_pedido: 'Efetivado', email: 'ninguem@y.com' })
  assert.equal(r.status, 200); assert.equal(r.data.matched, false)
  console.log('✓ pedido localizado pelo e-mail quando a UTM não volta; desconhecido é só registrado')

  // 11. Cancelado: pago vira reembolsado; pendente vira falhou
  await wh({ pedido: 555001, status_pedido: 'Cancelado' })
  assert.equal((await pool.query('SELECT status FROM orders WHERE id = $1', [o1.id])).rows[0].status, 'refunded')
  await wh({ status_pedido: 'Cancelado', utm_content: `pedido-${o3.id}` })
  assert.equal((await pool.query('SELECT status FROM orders WHERE id = $1', [o3.id])).rows[0].status, 'failed')
  const ev = (await pool.query(`SELECT count(*)::int n FROM tmb_events WHERE order_id IN ($1,$2,$3)`, [o1.id, o2.id, o3.id])).rows[0].n
  assert.ok(ev >= 6)
  console.log('✓ "Cancelado" atualiza o pedido; todos os avisos ficam registrados')

  // 12. Erro na API da TMB: pedido falha com mensagem e WhatsApp
  await pool.query(`UPDATE tmb_offers SET active = false`)
  process.env.TMB_API_TOKEN_BACKUP = process.env.TMB_API_TOKEN
  global.fetch = async (url, opts) => String(url).startsWith('https://api.tmbeducacao.com.br')
    ? new Response(JSON.stringify({ message: 'Produto expirado' }), { status: 400 }) : realFetch(url, opts)
  r = await j('POST', '/orders', { course_ids: [pos1.id], customer_name: 'Davi Reis', customer_email: 'tmb4@y.com', customer_phone: '61999999999', payment_method: 'tmb' })
  assert.equal(r.status, 502); assert.equal(r.data.mode, 'error')
  row = (await pool.query('SELECT * FROM orders WHERE id = $1', [r.data.order.id])).rows[0]
  assert.equal(row.status, 'failed'); assert.match(row.payment_error, /Produto expirado/)
  console.log('✓ erro da TMB (ex.: produto expirado) aparece no pedido e o cliente pode escolher outra forma')

  // 13. Blog agendado: só aparece depois da data/hora
  const future = new Date(Date.now() + 2 * 3600 * 1000).toISOString()
  r = await j('POST', '/blog', { title: 'Teste v24 agendado', slug: 'teste-v24-agendado', content: '<p>x</p>', published: true, published_at: future }, auth)
  assert.equal(r.status, 201)
  assert.equal(new Date(r.data.published_at).toISOString(), future, 'data gravada em UTC sem deslocar o fuso')
  const postId = r.data.id
  r = await j('GET', '/blog/slug/teste-v24-agendado'); assert.equal(r.status, 404)
  r = await j('GET', '/blog?limit=100'); assert.ok(!r.data.some(p => p.slug === 'teste-v24-agendado'))
  const past = new Date(Date.now() - 60 * 1000).toISOString()
  r = await j('PUT', `/blog/${postId}`, { title: 'Teste v24 agendado', slug: 'teste-v24-agendado', content: '<p>x</p>', published: true, published_at: past }, auth)
  r = await j('GET', '/blog/slug/teste-v24-agendado'); assert.equal(r.status, 200)
  r = await j('PUT', `/blog/${postId}`, { title: 'Teste v24 agendado', slug: 'teste-v24-agendado', content: '<p>x</p>', published: false, published_at: past }, auth)
  r = await j('GET', '/blog/slug/teste-v24-agendado'); assert.equal(r.status, 404)
  r = await j('POST', '/blog', { title: 'Teste v24 publicar agora', slug: 'teste-v24-agora', published: true }, auth)
  assert.ok(Math.abs(new Date(r.data.published_at).getTime() - Date.now()) < 60000, 'publicar sem data usa agora (UTC)')
  console.log('✓ blog: rascunho, publicar agora e agendamento com horário certo')

  // 14. Parceiros (IES e empresa/convênio)
  r = await j('POST', '/partners', { name: 'X' }); assert.equal(r.status, 401)
  r = await j('POST', '/partners', { type: 'ies', name: 'Centro Universitário Teste V24', emec_code: '3649', emec_url: 'emec.mec.gov.br/x', related_category: 'Pós-Graduação', summary: 'IES parceira' }, auth)
  assert.equal(r.status, 201); assert.equal(r.data.slug, 'centro-universitario-teste-v24'); assert.equal(r.data.emec_url, 'https://emec.mec.gov.br/x')
  const iesId = r.data.id
  r = await j('POST', '/partners', { type: 'ies', name: 'Centro Universitário Teste V24' }, auth); assert.equal(r.status, 409)
  await pool.query("INSERT INTO coupons (code, discount_percent, active) VALUES ('CONVV24', 15, true) ON CONFLICT (code) DO NOTHING")
  r = await j('POST', '/partners', { type: 'empresa', name: 'Sindicato Teste V24', slug: 'teste-v24-sindicato', benefit: '15% de desconto', coupon_code: 'convv24', eligibility: 'associados' }, auth)
  assert.equal(r.status, 201); assert.equal(r.data.coupon_code, 'CONVV24')
  const empId = r.data.id
  r = await j('POST', '/partners', { type: 'empresa', name: 'Oculto Teste V24', slug: 'teste-v24-oculto', active: false }, auth)
  r = await j('GET', '/partners')
  const slugs = r.data.map(p => p.slug)
  assert.ok(slugs.includes('centro-universitario-teste-v24') && slugs.includes('teste-v24-sindicato') && !slugs.includes('teste-v24-oculto'))
  assert.ok(!('coupon_code' in r.data[0]) && !('content' in r.data[0]), 'lista pública enxuta')
  r = await j('GET', '/partners?type=ies'); assert.ok(r.data.every(p => p.type === 'ies'))
  r = await j('GET', '/partners/slug/centro-universitario-teste-v24')
  assert.equal(r.data.emec_code, '3649'); assert.ok(r.data.related_courses.some(c => c.slug === 'teste-v24-pos1'))
  r = await j('GET', '/partners/slug/teste-v24-sindicato')
  assert.deepEqual(r.data.coupon, { code: 'CONVV24', discount_percent: 15 }); assert.ok(!('coupon_code' in r.data))
  await pool.query("UPDATE coupons SET active = false WHERE code = 'CONVV24'")
  r = await j('GET', '/partners/slug/teste-v24-sindicato'); assert.equal(r.data.coupon, null)
  r = await j('GET', '/partners/slug/teste-v24-oculto'); assert.equal(r.status, 404)
  r = await j('GET', '/partners/admin/all', null, auth); assert.ok(r.data.some(p => p.slug === 'teste-v24-oculto'))
  assert.equal(r.data.find(p => p.id === empId).coupon_active, false)
  r = await j('PUT', `/partners/${iesId}`, { type: 'ies', name: 'Centro Universitário Teste V24', slug: 'teste-v24-ies', active: false }, auth)
  assert.equal(r.data.slug, 'teste-v24-ies')
  r = await j('GET', '/partners/slug/teste-v24-ies'); assert.equal(r.status, 404)
  r = await j('DELETE', `/partners/${empId}`, null, auth); assert.equal(r.status, 200)
  console.log('✓ parceiros: cadastro só com login, slug único, lista e página pública, oculto fora do site, cupom só se ativo')

  await cleanup()
  srv.close(); await pool.end()
  console.log('\nTODOS OS TESTES DA v2.4 PASSARAM')
})().catch(async err => {
  console.error('\nFALHOU:', err)
  try { await cleanup() } catch {}
  process.exit(1)
})

async function cleanup() {
  await pool.query(`DELETE FROM tmb_events WHERE order_id IN (SELECT id FROM orders WHERE customer_email LIKE 'tmb%@y.com') OR tmb_order_id IN (555001,555002,999999)`)
  await pool.query(`DELETE FROM orders WHERE customer_email LIKE 'tmb%@y.com'`)
  await pool.query(`DELETE FROM courses WHERE slug LIKE 'teste-v24-%'`)
  await pool.query(`INSERT INTO app_settings (key, data) VALUES ('migracao_v24_parcela_sem_juros', '{}') ON CONFLICT (key) DO NOTHING`)
  await pool.query(`DELETE FROM blog_posts WHERE slug LIKE 'teste-v24-%'`)
  await pool.query(`DELETE FROM coupons WHERE code IN ('TESTEV24','CONVV24')`)
  await pool.query(`DELETE FROM partners WHERE slug LIKE 'teste-v24-%' OR slug = 'centro-universitario-teste-v24'`)
  await pool.query(`DELETE FROM tmb_offers`)
  await pool.query(`DELETE FROM app_settings WHERE key = 'tmb'`)
}
