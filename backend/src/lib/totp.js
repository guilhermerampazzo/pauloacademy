// TOTP (RFC 6238) – códigos de 6 dígitos a cada 30 s, compatível com
// Google Authenticator, Microsoft Authenticator, Authy, 1Password etc.
// Implementação própria (sem dependência externa), só com o módulo crypto do Node.
const crypto = require('crypto')

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const STEP = 30
const DIGITS = 6

function base32Encode(buf) {
  let bits = 0, value = 0, out = ''
  for (const byte of buf) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) { out += ALPHABET[(value >>> (bits - 5)) & 31]; bits -= 5 }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

function base32Decode(str) {
  const clean = String(str).toUpperCase().replace(/=+$/, '').replace(/\s/g, '')
  let bits = 0, value = 0
  const out = []
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch)
    if (idx === -1) throw new Error('base32 inválido')
    value = (value << 5) | idx
    bits += 5
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8 }
  }
  return Buffer.from(out)
}

function generateSecret() {
  return base32Encode(crypto.randomBytes(20)) // 160 bits, recomendado pela RFC 4226
}

function hotp(secret, counter) {
  const key = base32Decode(secret)
  const buf = Buffer.alloc(8)
  buf.writeBigUInt64BE(BigInt(counter))
  const hmac = crypto.createHmac('sha1', key).update(buf).digest()
  const offset = hmac[hmac.length - 1] & 0xf
  const code = ((hmac.readUInt32BE(offset) & 0x7fffffff) % 10 ** DIGITS)
  return String(code).padStart(DIGITS, '0')
}

function currentStep(now = Date.now()) {
  return Math.floor(now / 1000 / STEP)
}

/**
 * Verifica o código aceitando 1 passo antes/depois (relógio do celular adiantado ou atrasado).
 * Retorna o "step" usado (para bloquear reuso do mesmo código) ou null.
 */
function verify(secret, code, { window = 1, now = Date.now() } = {}) {
  const c = String(code || '').replace(/\D/g, '')
  if (c.length !== DIGITS) return null
  const step = currentStep(now)
  for (let w = -window; w <= window; w++) {
    const expected = hotp(secret, step + w)
    if (crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(c))) return step + w
  }
  return null
}

function otpauthUrl(secret, account, issuer = 'Academy Pop') {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=${DIGITS}&period=${STEP}`
}

// ---------------------------------------------------------------------------
// Criptografia do segredo em repouso (AES-256-GCM).
// Chave: TWOFA_ENCRYPTION_KEY (recomendado). Sem ela, o segredo fica em texto
// no banco e o backend avisa no log. NÃO use o JWT_SECRET como chave: trocar o
// JWT_SECRET travaria o 2FA de todos os admins.
// ---------------------------------------------------------------------------
function key() {
  const k = process.env.TWOFA_ENCRYPTION_KEY
  return k ? crypto.createHash('sha256').update(k).digest() : null
}

function sealSecret(secret) {
  const k = key()
  if (!k) return `plain:${secret}`
  const iv = crypto.randomBytes(12)
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv)
  const enc = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()])
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${enc.toString('base64')}`
}

function openSecret(stored) {
  if (!stored) return null
  if (stored.startsWith('plain:')) return stored.slice(6)
  const [v, iv, tag, data] = stored.split(':')
  if (v !== 'v1') throw new Error('formato de segredo desconhecido')
  const k = key()
  if (!k) throw new Error('TWOFA_ENCRYPTION_KEY ausente: não é possível ler o segredo do 2FA')
  const decipher = crypto.createDecipheriv('aes-256-gcm', k, Buffer.from(iv, 'base64'))
  decipher.setAuthTag(Buffer.from(tag, 'base64'))
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64')), decipher.final()]).toString('utf8')
}

// Códigos de recuperação: 10 códigos de uso único no formato XXXX-XXXX
function generateRecoveryCodes(n = 10) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // sem 0/O/1/I
  return Array.from({ length: n }, () => {
    const b = crypto.randomBytes(8)
    const s = Array.from(b, x => chars[x % chars.length]).join('')
    return `${s.slice(0, 4)}-${s.slice(4)}`
  })
}

function hashRecoveryCode(code) {
  return crypto.createHash('sha256').update(String(code).toUpperCase().replace(/[^A-Z0-9]/g, '')).digest('hex')
}

module.exports = {
  generateSecret, verify, hotp, currentStep, otpauthUrl,
  sealSecret, openSecret, generateRecoveryCodes, hashRecoveryCode, base32Decode, base32Encode,
}
