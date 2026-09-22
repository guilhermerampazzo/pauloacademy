#!/usr/bin/env node
// Recuperação de acesso ao painel pelo SERVIDOR (para quando não há e-mail
// configurado ou o admin perdeu o celular do 2FA e os códigos de recuperação).
//
// Uso (na pasta do projeto, no servidor):
//   docker compose exec backend node src/cli/admin-recovery.js list
//   docker compose exec backend node src/cli/admin-recovery.js reset-link  <email>   # gera link de nova senha (30 min)
//   docker compose exec backend node src/cli/admin-recovery.js temp-password <email> # define senha temporária aleatória
//   docker compose exec backend node src/cli/admin-recovery.js disable-2fa <email>   # desativa o 2FA
//
// Toda ação encerra as sessões abertas do usuário e fica registrada em auth_events.
require('dotenv').config()
const crypto = require('crypto')
const bcrypt = require('bcryptjs')
const { pool } = require('../db')
const { appUrl } = require('../lib/settings')

const [, , cmd, emailArg] = process.argv
const email = String(emailArg || '').trim().toLowerCase()

async function user() {
  const { rows } = await pool.query('SELECT * FROM users WHERE lower(email) = $1', [email])
  if (!rows.length) { console.error(`Usuário ${email} não encontrado.`); process.exit(1) }
  return rows[0]
}
const log = (u, event) => pool.query('INSERT INTO auth_events (user_id, email, event, ip) VALUES ($1,$2,$3,$4)', [u.id, u.email, event, 'cli'])

async function main() {
  if (cmd === 'list') {
    const { rows } = await pool.query('SELECT id, email, name, totp_enabled, last_login_at FROM users ORDER BY id')
    console.table(rows)
  } else if (cmd === 'reset-link') {
    const u = await user()
    const token = crypto.randomBytes(32).toString('hex')
    await pool.query('UPDATE password_resets SET used_at = NOW() WHERE user_id = $1 AND used_at IS NULL', [u.id])
    await pool.query(`INSERT INTO password_resets (user_id, token_hash, expires_at, requested_ip) VALUES ($1,$2,NOW() + INTERVAL '30 minutes','cli')`,
      [u.id, crypto.createHash('sha256').update(token).digest('hex')])
    await log(u, 'password_reset_link_cli')
    console.log(`\nLink válido por 30 minutos (uso único):\n${appUrl() || 'https://SEU-DOMINIO'}/admin/redefinir-senha?token=${token}\n`)
    console.log('Envie este link ao administrador por um canal seguro. O 2FA, se ativado, continua sendo exigido.')
  } else if (cmd === 'temp-password') {
    const u = await user()
    const pwd = crypto.randomBytes(9).toString('base64url') + '-' + crypto.randomBytes(3).toString('hex')
    await pool.query('UPDATE users SET password_hash = $1, token_version = token_version + 1, password_changed_at = NOW() WHERE id = $2',
      [await bcrypt.hash(pwd, 10), u.id])
    await log(u, 'password_temp_cli')
    console.log(`\nSenha temporária de ${u.email}: ${pwd}\nPeça para trocá-la em Admin > Segurança da conta logo após entrar.\n`)
  } else if (cmd === 'disable-2fa') {
    const u = await user()
    await pool.query(`UPDATE users SET totp_enabled = false, totp_secret = NULL, totp_pending_secret = NULL, totp_last_step = NULL,
                      recovery_codes = '[]', token_version = token_version + 1 WHERE id = $1`, [u.id])
    await log(u, '2fa_disabled_cli')
    console.log(`\n2FA desativado para ${u.email}. Oriente o administrador a ativá-lo de novo em Admin > Segurança da conta.\n`)
  } else {
    console.log('Comandos: list | reset-link <email> | temp-password <email> | disable-2fa <email>')
    process.exitCode = 1
  }
  await pool.end()
}
main().catch(err => { console.error(err.message); process.exit(1) })
