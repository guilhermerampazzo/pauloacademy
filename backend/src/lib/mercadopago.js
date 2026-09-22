const crypto = require('crypto')
const { appUrl } = require('./settings')

function isEnabled() {
  return !!process.env.MERCADOPAGO_ACCESS_TOKEN
}

let _client = null
function client() {
  if (!_client) {
    const { MercadoPagoConfig } = require('mercadopago')
    _client = new MercadoPagoConfig({
      accessToken: process.env.MERCADOPAGO_ACCESS_TOKEN,
      options: { timeout: 15000 },
    })
  }
  return _client
}

// URL que o Mercado Pago chama para avisar mudanças de pagamento.
// Só é enviada quando APP_URL é https (o MP recusa localhost/http).
function notificationUrl() {
  const base = appUrl()
  return base.startsWith('https://') ? `${base}/api/orders/webhook/mercadopago` : undefined
}

function splitName(fullName) {
  const parts = String(fullName || '').trim().split(/\s+/)
  return { first_name: parts[0] || '', last_name: parts.slice(1).join(' ') || parts[0] || '' }
}

function describe(items) {
  const titles = items.map(i => i.title)
  const d = titles.length === 1 ? titles[0] : `${titles.length} cursos: ${titles.join('; ')}`
  return d.slice(0, 250)
}

async function createPix({ order, items, customer }) {
  const { Payment } = require('mercadopago')
  const result = await new Payment(client()).create({
    body: {
      transaction_amount: Number(order.amount),
      payment_method_id: 'pix',
      description: describe(items),
      external_reference: String(order.id),
      notification_url: notificationUrl(),
      payer: { email: customer.email, ...splitName(customer.name) },
    },
    requestOptions: { idempotencyKey: `order-${order.id}-pix` },
  })
  return {
    payment_id: String(result.id),
    pix_qr_code: result.point_of_interaction?.transaction_data?.qr_code || null,
    pix_qr_code_base64: result.point_of_interaction?.transaction_data?.qr_code_base64 || null,
  }
}

async function createBoleto({ order, items, customer }) {
  const { Payment } = require('mercadopago')
  const result = await new Payment(client()).create({
    body: {
      transaction_amount: Number(order.amount),
      payment_method_id: 'bolbradesco',
      description: describe(items),
      external_reference: String(order.id),
      notification_url: notificationUrl(),
      payer: {
        email: customer.email,
        ...splitName(customer.name),
        identification: { type: 'CPF', number: customer.cpf },
      },
    },
    requestOptions: { idempotencyKey: `order-${order.id}-boleto` },
  })
  return {
    payment_id: String(result.id),
    boleto_url: result.transaction_details?.external_resource_url || null,
    boleto_barcode: result.barcode?.content || null,
  }
}

async function createCardPreference({ order, items, customer, maxInstallments }) {
  const { Preference } = require('mercadopago')
  const base = appUrl()
  const back = base ? {
    success: `${base}/checkout/sucesso?pedido=${order.id}&t=${order.access_token}`,
    pending: `${base}/checkout/sucesso?pedido=${order.id}&t=${order.access_token}`,
    failure: `${base}/checkout/erro?pedido=${order.id}`,
  } : undefined
  const result = await new Preference(client()).create({
    body: {
      items: items.map(i => ({
        id: String(i.course_id),
        title: i.title.slice(0, 250),
        quantity: 1,
        currency_id: 'BRL',
        unit_price: Number(i.final_price),
      })),
      payer: { name: customer.name, email: customer.email },
      external_reference: String(order.id),
      notification_url: notificationUrl(),
      payment_methods: {
        excluded_payment_types: [{ id: 'ticket' }, { id: 'bank_transfer' }],
        installments: maxInstallments,
      },
      back_urls: back,
      auto_return: back ? 'approved' : undefined,
      statement_descriptor: 'ACADEMYPOP',
    },
  })
  return { preference_id: result.id, payment_url: result.init_point }
}

async function getPayment(id) {
  const { Payment } = require('mercadopago')
  return new Payment(client()).get({ id })
}

/**
 * Valida o cabeçalho x-signature enviado pelo Mercado Pago.
 * Manifesto oficial: "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
 * assinado com HMAC-SHA256 usando a "chave secreta" do webhook
 * (Suas integrações > Webhooks > Assinatura secreta).
 * Sem MERCADOPAGO_WEBHOOK_SECRET configurada, retorna null (não validado);
 * mesmo assim o status é sempre confirmado consultando a API do MP.
 */
function verifySignature(req, dataId) {
  const secret = process.env.MERCADOPAGO_WEBHOOK_SECRET
  if (!secret) return null
  const header = req.headers['x-signature'] || ''
  const requestId = req.headers['x-request-id'] || ''
  const parts = Object.fromEntries(String(header).split(',').map(p => p.split('=').map(s => s.trim())))
  const ts = parts.ts
  const v1 = parts.v1
  if (!ts || !v1) return false
  let manifest = ''
  if (dataId) manifest += `id:${/^[a-z0-9]+$/i.test(dataId) ? String(dataId).toLowerCase() : dataId};`
  if (requestId) manifest += `request-id:${requestId};`
  manifest += `ts:${ts};`
  const expected = crypto.createHmac('sha256', secret).update(manifest).digest('hex')
  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(v1))
  } catch {
    return false
  }
}

module.exports = { isEnabled, createPix, createBoleto, createCardPreference, getPayment, verifySignature }
