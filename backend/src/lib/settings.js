const { pool } = require('../db')

// Número de WhatsApp usado pelo backend (links de fallback do checkout).
// Antes: lia NEXT_PUBLIC_WHATSAPP_NUMBER, que não era passada ao container do
// backend -> caía no número fictício 5511999999999.
// Agora: 1º o número cadastrado no CMS (Conteúdo > Rodapé), 2º WHATSAPP_NUMBER,
// 3º NEXT_PUBLIC_WHATSAPP_NUMBER.
let cache = { value: null, at: 0 }

async function getWhatsAppNumber() {
  if (cache.value && Date.now() - cache.at < 60_000) return cache.value
  let number = ''
  try {
    const { rows } = await pool.query(`SELECT data->>'whatsapp' AS whatsapp FROM content_sections WHERE key = 'footer'`)
    number = (rows[0]?.whatsapp || '').replace(/\D/g, '')
  } catch { /* ignora: usa env */ }
  if (!number) number = (process.env.WHATSAPP_NUMBER || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '').replace(/\D/g, '')
  cache = { value: number, at: Date.now() }
  return number
}

function appUrl() {
  return (process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || '').replace(/\/$/, '')
}

module.exports = { getWhatsAppNumber, appUrl }
