const { pool } = require('../db')

const round2 = n => Math.round(n * 100) / 100

// Preço de um curso conforme a forma de pagamento.
// PIX/boleto: price_pix. Cartão: price_installment (total parcelado) quando
// cadastrado, senão price_pix. Antes o cartão sempre cobrava price_pix, mesmo
// quando a página anunciava outro total parcelado.
function unitPrice(course, method) {
  const pix = Number(course.price_pix || 0)
  const card = Number(course.price_installment || 0)
  if (method === 'credit_card' && card > 0) return card
  return pix
}

async function findCoupon(code) {
  if (!code) return null
  const { rows } = await pool.query(
    `SELECT * FROM coupons WHERE code = $1 AND active = true
       AND (expires_at IS NULL OR expires_at > NOW())
       AND (max_uses IS NULL OR used_count < max_uses)`,
    [String(code).trim().toUpperCase()]
  )
  return rows[0] || null
}

/**
 * Calcula o carrinho SEMPRE no servidor, a partir dos preços do banco.
 * @param {number[]} courseIds
 * @param {string|null} couponCode
 * @param {'pix'|'boleto'|'credit_card'} method
 * @returns {{items, unavailable, subtotal, discount, total, coupon, couponError, maxInstallments}}
 */
async function priceCart(courseIds, couponCode, method = 'pix') {
  const ids = [...new Set((courseIds || []).map(Number).filter(n => Number.isInteger(n) && n > 0))].slice(0, 20)
  if (!ids.length) {
    return { items: [], unavailable: [], subtotal: 0, discount: 0, total: 0, coupon: null, couponError: null, maxInstallments: 1 }
  }

  const { rows } = await pool.query(
    `SELECT id, slug, title, cover_image, category, workload, duration, modality,
            price_pix, price_installment, installments, installment_value, active
     FROM courses WHERE id = ANY($1::int[])`,
    [ids]
  )
  const byId = new Map(rows.map(r => [r.id, r]))

  const coupon = await findCoupon(couponCode)
  let couponError = null
  if (couponCode && !coupon) couponError = 'Cupom inválido ou expirado'

  const items = []
  const unavailable = []
  for (const id of ids) {
    const c = byId.get(id)
    const price = c ? unitPrice(c, method) : 0
    // Cursos inativos ou sem preço ("Consulte condições") não podem ser comprados online
    if (!c || !c.active || price <= 0) {
      unavailable.push({ course_id: id, title: c?.title || null, reason: !c || !c.active ? 'indisponivel' : 'sem_preco' })
      continue
    }
    const eligible = coupon && (coupon.course_id === null || coupon.course_id === c.id)
    const discount = eligible ? round2(price * Number(coupon.discount_percent) / 100) : 0
    items.push({
      course_id: c.id,
      slug: c.slug,
      title: c.title,
      cover_image: c.cover_image,
      category: c.category,
      workload: c.workload,
      duration: c.duration,
      modality: c.modality,
      installments: c.installments,
      unit_price: round2(price),
      discount,
      final_price: round2(price - discount),
      coupon_applied: !!eligible,
    })
  }

  if (coupon && items.length && !items.some(i => i.coupon_applied)) {
    couponError = 'Este cupom não vale para os cursos do carrinho'
  }

  const subtotal = round2(items.reduce((s, i) => s + i.unit_price, 0))
  const discount = round2(items.reduce((s, i) => s + i.discount, 0))
  const total = round2(subtotal - discount)
  // Parcelamento máximo = o menor entre os cursos do carrinho (regra conservadora)
  const maxInstallments = items.length ? Math.max(1, Math.min(...items.map(i => Number(i.installments) || 1))) : 1

  return {
    items,
    unavailable,
    subtotal,
    discount,
    total,
    coupon: coupon && !couponError ? { id: coupon.id, code: coupon.code, discount_percent: Number(coupon.discount_percent) } : null,
    couponError,
    maxInstallments,
  }
}

module.exports = { priceCart, unitPrice, round2 }
