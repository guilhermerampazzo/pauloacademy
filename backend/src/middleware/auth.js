const jwt = require('jsonwebtoken')
const { pool } = require('../db')

// Verifica o token do admin.
// v2.1: além da assinatura, confere o token_version do usuário no banco. Assim,
// trocar/redefinir a senha ou desativar o 2FA encerra as sessões antigas.
// Tokens de "desafio 2FA" (etapa intermediária do login) não passam aqui.
async function requireAuth(req, res, next) {
  const header = req.headers.authorization
  const token = header && header.startsWith('Bearer ') ? header.slice(7) : null

  if (!token) {
    return res.status(401).json({ error: 'Token não fornecido' })
  }

  let payload
  try {
    payload = jwt.verify(token, process.env.JWT_SECRET)
  } catch {
    return res.status(401).json({ error: 'Token inválido ou expirado' })
  }
  if (payload.purpose) return res.status(401).json({ error: 'Token inválido' })

  try {
    const { rows } = await pool.query('SELECT id, email, name, token_version FROM users WHERE id = $1', [payload.id])
    if (!rows.length || Number(rows[0].token_version) !== Number(payload.tv || 0)) {
      return res.status(401).json({ error: 'Sessão encerrada. Entre novamente.' })
    }
    req.user = { ...payload, email: rows[0].email, name: rows[0].name }
    next()
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro de autenticação' })
  }
}

module.exports = { requireAuth }
