const router = require('express').Router()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const { pool } = require('../db')
const { requireAuth } = require('../middleware/auth')
const totp = require('../lib/totp')
const mailer = require('../lib/mailer')
const { appUrl } = require('../lib/settings')

// ---------------------------------------------------------------------------
// Limites de tentativas (por IP)
// ---------------------------------------------------------------------------
const limiter = (limit, windowMin, message, skipOk = true) => rateLimit({
  windowMs: windowMin * 60 * 1000,
  limit,
  skipSuccessfulRequests: skipOk,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: { error: message },
})
const loginLimiter = limiter(5, 15, 'Muitas tentativas de login. Aguarde 15 minutos.')
const twofaLimiter = limiter(8, 15, 'Muitas tentativas com o código. Aguarde 15 minutos.')
const forgotLimiter = limiter(5, 60, 'Muitos pedidos de recuperação. Tente novamente em 1 hora.', false)
const resetLimiter = limiter(10, 60, 'Muitas tentativas. Tente novamente em 1 hora.')
const sensitiveLimiter = limiter(10, 15, 'Muitas tentativas. Aguarde 15 minutos.')

const MIN_PASSWORD = 10
const RESET_TTL_MIN = 30
const CHALLENGE_TTL = '5m'
const SESSION_TTL = '7d'

// O token de "desafio 2FA" é assinado com outra chave: não serve como sessão
// nem no backend nem no middleware do Next (que valida com JWT_SECRET).
const challengeSecret = () => `${process.env.JWT_SECRET}::2fa-challenge`
const sha256 = s => crypto.createHash('sha256').update(String(s)).digest('hex')
const clientIp = req => String(req.ip || '').slice(0, 64)

function issueSession(user) {
  return jwt.sign(
    { id: user.id, email: user.email, name: user.name, tv: Number(user.token_version || 0) },
    process.env.JWT_SECRET,
    { expiresIn: SESSION_TTL }
  )
}

async function logEvent(req, event, user, email) {
  try {
    await pool.query(
      'INSERT INTO auth_events (user_id, email, event, ip, user_agent) VALUES ($1,$2,$3,$4,$5)',
      [user?.id || null, (email || user?.email || '').slice(0, 255) || null, event, clientIp(req), String(req.headers['user-agent'] || '').slice(0, 300)]
    )
  } catch (err) { console.error('auth_events:', err.message) }
}

function passwordProblem(pw) {
  if (!pw || String(pw).length < MIN_PASSWORD) return `A senha precisa ter pelo menos ${MIN_PASSWORD} caracteres`
  if (String(pw).length > 200) return 'Senha longa demais'
  return null
}

async function notify(user, subject, html) {
  return mailer.send({ to: user.email, subject: `[Academy Pop] ${subject}`, title: subject, html, text: html.replace(/<[^>]+>/g, ' ') })
}

const when = () => new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })

// Hash fixo para igualar o tempo de resposta quando o e-mail não existe
const DUMMY_HASH = bcrypt.hashSync('dummy-password-for-timing', 10)

// ---------------------------------------------------------------------------
// Login – etapa 1 (e-mail + senha)
// ---------------------------------------------------------------------------
router.post('/login', loginLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  const password = String(req.body?.password || '')
  if (!email || !password) return res.status(400).json({ error: 'E-mail e senha são obrigatórios' })

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = $1', [email])
    const user = rows[0]
    const valid = await bcrypt.compare(password, user ? user.password_hash : DUMMY_HASH)
    if (!user || !valid) {
      await logEvent(req, 'login_failed', user, email)
      return res.status(401).json({ error: 'Credenciais inválidas' })
    }

    // Com 2FA: devolve um desafio de 5 minutos; a sessão só sai após o código
    if (user.totp_enabled) {
      const challenge = jwt.sign({ id: user.id, purpose: '2fa', tv: user.token_version }, challengeSecret(), { expiresIn: CHALLENGE_TTL })
      await logEvent(req, 'login_password_ok_2fa_pending', user)
      return res.json({ requires_2fa: true, challenge })
    }

    await pool.query('UPDATE users SET last_login_at = NOW() WHERE id = $1', [user.id])
    await logEvent(req, 'login_success', user)
    res.json({ token: issueSession(user), user: { id: user.id, email: user.email, name: user.name, totp_enabled: false } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ---------------------------------------------------------------------------
// Login – etapa 2 (código do app autenticador ou código de recuperação)
// ---------------------------------------------------------------------------
router.post('/login/2fa', twofaLimiter, async (req, res) => {
  const { challenge, code, recovery_code } = req.body || {}
  let payload
  try {
    payload = jwt.verify(String(challenge || ''), challengeSecret())
    if (payload.purpose !== '2fa') throw new Error('purpose')
  } catch {
    return res.status(401).json({ error: 'Etapa expirada. Faça o login novamente.', restart: true })
  }

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [payload.id])
    const user = rows[0]
    if (!user || !user.totp_enabled || Number(user.token_version) !== Number(payload.tv)) {
      return res.status(401).json({ error: 'Etapa expirada. Faça o login novamente.', restart: true })
    }

    if (recovery_code) {
      const h = totp.hashRecoveryCode(recovery_code)
      const codes = Array.isArray(user.recovery_codes) ? user.recovery_codes : []
      if (!codes.includes(h)) {
        await logEvent(req, '2fa_recovery_failed', user)
        return res.status(401).json({ error: 'Código de recuperação inválido' })
      }
      const remaining = codes.filter(c => c !== h)
      await pool.query('UPDATE users SET recovery_codes = $1, last_login_at = NOW() WHERE id = $2', [JSON.stringify(remaining), user.id])
      await logEvent(req, '2fa_recovery_used', user)
      await notify(user, 'Código de recuperação usado no login',
        `<p>Um código de recuperação foi usado para entrar no painel em ${when()} (IP ${mailer.esc(clientIp(req))}).</p><p>Restam <b>${remaining.length}</b> códigos. Se não foi você, troque a senha imediatamente.</p>`)
      return res.json({ token: issueSession(user), recovery_codes_left: remaining.length, user: { id: user.id, email: user.email, name: user.name, totp_enabled: true } })
    }

    const secret = totp.openSecret(user.totp_secret)
    const step = totp.verify(secret, code)
    if (step === null || (user.totp_last_step && step <= Number(user.totp_last_step))) {
      await logEvent(req, '2fa_failed', user)
      return res.status(401).json({ error: 'Código inválido ou já utilizado' })
    }
    await pool.query('UPDATE users SET totp_last_step = $1, last_login_at = NOW() WHERE id = $2', [step, user.id])
    await logEvent(req, 'login_success_2fa', user)
    res.json({ token: issueSession(user), user: { id: user.id, email: user.email, name: user.name, totp_enabled: true } })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ---------------------------------------------------------------------------
// Sessão atual
// ---------------------------------------------------------------------------
router.get('/me', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT id, email, name, totp_enabled, recovery_codes, password_changed_at, last_login_at FROM users WHERE id = $1',
    [req.user.id]
  ).catch(() => ({ rows: [] }))
  const u = rows[0]
  if (!u) return res.status(404).json({ error: 'Usuário não encontrado' })
  res.json({
    user: {
      id: u.id, email: u.email, name: u.name,
      totp_enabled: u.totp_enabled,
      recovery_codes_left: Array.isArray(u.recovery_codes) ? u.recovery_codes.length : 0,
      password_changed_at: u.password_changed_at,
      last_login_at: u.last_login_at,
    },
    email_enabled: mailer.isEnabled(),
  })
})

// ---------------------------------------------------------------------------
// Troca de senha (logado). Encerra as outras sessões e devolve um token novo.
// ---------------------------------------------------------------------------
router.post('/change-password', requireAuth, sensitiveLimiter, async (req, res) => {
  const { current_password, new_password } = req.body || {}
  const problem = passwordProblem(new_password)
  if (problem) return res.status(400).json({ error: problem })
  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id])
    const user = rows[0]
    if (!user) return res.status(404).json({ error: 'Usuário não encontrado' })
    if (!(await bcrypt.compare(String(current_password || ''), user.password_hash))) {
      await logEvent(req, 'password_change_failed', user)
      return res.status(401).json({ error: 'Senha atual incorreta' })
    }
    const hash = await bcrypt.hash(String(new_password), 10)
    const { rows: upd } = await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1, password_changed_at = NOW()
       WHERE id = $2 RETURNING *`, [hash, user.id])
    await logEvent(req, 'password_changed', user)
    await notify(user, 'Sua senha foi alterada', `<p>A senha do painel foi alterada em ${when()}.</p><p>As outras sessões abertas foram encerradas.</p>`)
    res.json({ message: 'Senha alterada com sucesso', token: issueSession(upd[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ---------------------------------------------------------------------------
// Recuperação de senha por e-mail
// ---------------------------------------------------------------------------
router.post('/forgot-password', forgotLimiter, async (req, res) => {
  const email = String(req.body?.email || '').trim().toLowerCase()
  // Resposta sempre igual: não revela se o e-mail está cadastrado
  const generic = { message: 'Se o e-mail estiver cadastrado, você receberá um link para criar uma nova senha em alguns minutos.' }
  if (!email) return res.json(generic)

  try {
    const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = $1', [email])
    const user = rows[0]
    await logEvent(req, 'password_reset_requested', user, email)
    if (!user) return res.json(generic)

    if (!mailer.isEnabled()) {
      console.warn(`[recuperação] Pedido de nova senha para ${email}, mas o SMTP não está configurado. ` +
        'Configure SMTP_* no .env ou gere o link no servidor: docker compose exec backend node src/cli/admin-recovery.js reset-link ' + email)
      return res.json(generic)
    }

    const token = crypto.randomBytes(32).toString('hex')
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [user.id])
    await pool.query(
      `INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip)
       VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval, $4)`,
      [user.id, sha256(token), String(RESET_TTL_MIN), clientIp(req)]
    )
    const link = `${appUrl() || ''}/admin/redefinir-senha?token=${token}`
    await notify(user, 'Criar nova senha do painel',
      `<p>Recebemos um pedido para criar uma nova senha do painel da Academy Pop.</p>
       <p style="margin:24px 0"><a href="${link}" style="background:#ea580c;color:#fff;text-decoration:none;padding:12px 20px;border-radius:8px;font-weight:bold">Criar nova senha</a></p>
       <p>O link vale por <b>${RESET_TTL_MIN} minutos</b> e só pode ser usado uma vez.</p>
       <p>Se você não pediu, ignore esta mensagem: sua senha atual continua valendo.</p>
       <p style="color:#6b7280;font-size:12px">Pedido feito em ${when()} (IP ${mailer.esc(clientIp(req))}).</p>`)
    res.json(generic)
  } catch (err) {
    console.error(err)
    res.json(generic)
  }
})

async function findReset(token) {
  if (!/^[a-f0-9]{64}$/i.test(String(token || ''))) return null
  const { rows } = await pool.query(
    `SELECT pr.id AS reset_id, u.* FROM password_resets pr JOIN users u ON u.id = pr.user_id
     WHERE pr.token_hash = $1 AND pr.used_at IS NULL AND pr.expires_at > NOW()`,
    [sha256(token)]
  )
  return rows[0] || null
}

router.get('/reset-password/validate', resetLimiter, async (req, res) => {
  const row = await findReset(req.query.token).catch(() => null)
  res.json({ valid: !!row, email: row ? row.email.replace(/^(.).*(@.*)$/, '$1***$2') : null, totp_enabled: row ? row.totp_enabled : false })
})

router.post('/reset-password', resetLimiter, async (req, res) => {
  const { token, new_password } = req.body || {}
  const problem = passwordProblem(new_password)
  if (problem) return res.status(400).json({ error: problem })
  try {
    const row = await findReset(token)
    if (!row) return res.status(400).json({ error: 'Link inválido ou expirado. Peça um novo.' })
    const hash = await bcrypt.hash(String(new_password), 10)
    await pool.query(
      `UPDATE users SET password_hash = $1, token_version = token_version + 1, password_changed_at = NOW() WHERE id = $2`,
      [hash, row.id])
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [row.id])
    await logEvent(req, 'password_reset_done', row)
    await notify(row, 'Sua senha foi redefinida',
      `<p>A senha do painel foi redefinida pelo link de recuperação em ${when()} (IP ${mailer.esc(clientIp(req))}).</p><p>Todas as sessões abertas foram encerradas.</p>`)
    res.json({
      message: row.totp_enabled
        ? 'Senha redefinida. Entre com a nova senha e o código do seu aplicativo autenticador.'
        : 'Senha redefinida. Entre com a nova senha.',
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro interno' })
  }
})

// ---------------------------------------------------------------------------
// Autenticação em 2 fatores (TOTP)
// ---------------------------------------------------------------------------
async function loadUser(id) {
  const { rows } = await pool.query('SELECT * FROM users WHERE id = $1', [id])
  return rows[0]
}

async function checkPassword(user, password) {
  return bcrypt.compare(String(password || ''), user.password_hash)
}

function checkSecondFactor(user, { code, recovery_code }) {
  if (recovery_code) {
    const h = totp.hashRecoveryCode(recovery_code)
    return (user.recovery_codes || []).includes(h) ? { ok: true, usedRecovery: h } : { ok: false }
  }
  const step = totp.verify(totp.openSecret(user.totp_secret), code)
  if (step === null || (user.totp_last_step && step <= Number(user.totp_last_step))) return { ok: false }
  return { ok: true, step }
}

// 1) Gera o segredo e o QR code (exige a senha atual)
router.post('/2fa/setup', requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const user = await loadUser(req.user.id)
    if (user.totp_enabled) return res.status(400).json({ error: 'O 2FA já está ativado' })
    if (!(await checkPassword(user, req.body?.password))) return res.status(401).json({ error: 'Senha incorreta' })
    const secret = totp.generateSecret()
    await pool.query('UPDATE users SET totp_pending_secret = $1 WHERE id = $2', [totp.sealSecret(secret), user.id])
    const url = totp.otpauthUrl(secret, user.email)
    const QRCode = require('qrcode')
    const qr = await QRCode.toDataURL(url, { margin: 1, width: 220 })
    res.json({ secret: secret.match(/.{1,4}/g).join(' '), otpauth_url: url, qr_data_url: qr })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao iniciar o 2FA' })
  }
})

// 2) Confirma com o 1º código do app, ativa e devolve os códigos de recuperação (mostrados uma única vez)
router.post('/2fa/enable', requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const user = await loadUser(req.user.id)
    if (user.totp_enabled) return res.status(400).json({ error: 'O 2FA já está ativado' })
    if (!user.totp_pending_secret) return res.status(400).json({ error: 'Gere o QR code primeiro' })
    const step = totp.verify(totp.openSecret(user.totp_pending_secret), req.body?.code)
    if (step === null) return res.status(400).json({ error: 'Código inválido. Confira a hora do celular e tente de novo.' })
    const codes = totp.generateRecoveryCodes()
    await pool.query(
      `UPDATE users SET totp_enabled = true, totp_secret = totp_pending_secret, totp_pending_secret = NULL,
              totp_last_step = $1, recovery_codes = $2 WHERE id = $3`,
      [step, JSON.stringify(codes.map(totp.hashRecoveryCode)), user.id])
    await logEvent(req, '2fa_enabled', user)
    await notify(user, 'Autenticação em 2 fatores ativada', `<p>O 2FA foi ativado na sua conta do painel em ${when()}.</p>`)
    res.json({ message: '2FA ativado', recovery_codes: codes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao ativar o 2FA' })
  }
})

// Desativar (senha + código do app ou de recuperação). Encerra as outras sessões.
router.post('/2fa/disable', requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const user = await loadUser(req.user.id)
    if (!user.totp_enabled) return res.status(400).json({ error: 'O 2FA não está ativado' })
    if (!(await checkPassword(user, req.body?.password))) return res.status(401).json({ error: 'Senha incorreta' })
    if (!checkSecondFactor(user, req.body || {}).ok) return res.status(401).json({ error: 'Código inválido' })
    const { rows } = await pool.query(
      `UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_pending_secret = NULL, totp_last_step = NULL,
              recovery_codes = '[]', token_version = token_version + 1 WHERE id = $1 RETURNING *`, [user.id])
    await logEvent(req, '2fa_disabled', user)
    await notify(user, 'Autenticação em 2 fatores DESATIVADA', `<p>O 2FA foi desativado na sua conta do painel em ${when()} (IP ${mailer.esc(clientIp(req))}).</p>`)
    res.json({ message: '2FA desativado', token: issueSession(rows[0]) })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao desativar o 2FA' })
  }
})

// Gerar novos códigos de recuperação (invalida os anteriores)
router.post('/2fa/recovery-codes', requireAuth, sensitiveLimiter, async (req, res) => {
  try {
    const user = await loadUser(req.user.id)
    if (!user.totp_enabled) return res.status(400).json({ error: 'O 2FA não está ativado' })
    if (!(await checkPassword(user, req.body?.password))) return res.status(401).json({ error: 'Senha incorreta' })
    const check = checkSecondFactor(user, { code: req.body?.code })
    if (!check.ok) return res.status(401).json({ error: 'Código inválido' })
    const codes = totp.generateRecoveryCodes()
    await pool.query('UPDATE users SET recovery_codes = $1, totp_last_step = $2 WHERE id = $3',
      [JSON.stringify(codes.map(totp.hashRecoveryCode)), check.step, user.id])
    await logEvent(req, '2fa_recovery_regenerated', user)
    res.json({ recovery_codes: codes })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Erro ao gerar códigos' })
  }
})

// Histórico de segurança da própria conta
router.get('/events', requireAuth, async (req, res) => {
  const { rows } = await pool.query(
    'SELECT event, ip, user_agent, created_at FROM auth_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 30',
    [req.user.id]
  ).catch(() => ({ rows: [] }))
  res.json(rows)
})

module.exports = router
