// Testes da recuperação de senha e do 2FA do painel (v2.1).
// Rodar contra um banco de TESTE:
//   DATABASE_URL=postgresql://user:senha@localhost:5432/academypop_teste JWT_SECRET=<32+ caracteres> npm run test:auth
// O envio de e-mail é simulado. O script cria e apaga o próprio usuário de teste.
process.env.SMTP_HOST = 'smtp.teste'
process.env.SMTP_FROM = 'teste@teste'
process.env.TWOFA_ENCRYPTION_KEY = process.env.TWOFA_ENCRYPTION_KEY || 'chave-de-teste'
process.env.APP_URL = 'https://teste.local'

const path = require('path')
const assert = require('assert')
const bcrypt = require('bcryptjs')
const src = path.join(__dirname, '../src/')

// E-mails simulados
const sent = []
const mailerPath = require.resolve(src + 'lib/mailer.js')
const realMailer = require(mailerPath)
require.cache[mailerPath].exports = { ...realMailer, isEnabled: () => true, send: async m => { sent.push(m); return true } }

const { app } = require(src + 'index.js')
const { pool, initDb } = require(src + 'db')
const totp = require(src + 'lib/totp')

const EMAIL = 'teste-2fa@academypop.test'
let PASSWORD = 'SenhaInicial123'

;(async () => {
  await initDb()
  await pool.query('DELETE FROM users WHERE email = $1', [EMAIL])
  await pool.query('INSERT INTO users (email, password_hash, name) VALUES ($1, $2, $3)', [EMAIL, await bcrypt.hash(PASSWORD, 10), 'Teste 2FA'])

  const srv = app.listen(0); const B = `http://localhost:${srv.address().port}`
  const j = async (method, url, body, token) => {
    const r = await fetch(B + url, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    let data = null; try { data = await r.json() } catch {}
    return { status: r.status, data }
  }

  // 1. Login simples
  let r = await j('POST', '/auth/login', { email: EMAIL.toUpperCase(), password: PASSWORD })
  assert.equal(r.status, 200); let token = r.data.token
  r = await j('GET', '/auth/me', null, token); assert.equal(r.data.user.totp_enabled, false)
  r = await j('POST', '/auth/login', { email: EMAIL, password: 'errada' }); assert.equal(r.status, 401)
  r = await j('POST', '/auth/login', { email: 'naoexiste@x.com', password: 'errada' }); assert.equal(r.status, 401)
  console.log('✓ login (e-mail sem diferenciar maiúsculas; mesma resposta para e-mail inexistente)')

  // 2. Troca de senha encerra a sessão antiga
  r = await j('POST', '/auth/change-password', { current_password: PASSWORD, new_password: 'curta' }, token); assert.equal(r.status, 400)
  r = await j('POST', '/auth/change-password', { current_password: PASSWORD, new_password: 'SenhaNova12345' }, token)
  assert.equal(r.status, 200); const oldToken = token; token = r.data.token; PASSWORD = 'SenhaNova12345'
  assert.equal((await j('GET', '/auth/me', null, oldToken)).status, 401)
  assert.equal((await j('GET', '/auth/me', null, token)).status, 200)
  assert.ok(sent.some(m => m.subject.includes('senha foi alterada')))
  console.log('✓ troca de senha: mínimo 10 caracteres, sessão antiga encerrada, aviso por e-mail')

  // 3. Esqueci minha senha
  sent.length = 0
  r = await j('POST', '/auth/forgot-password', { email: 'naoexiste@x.com' }); assert.equal(r.status, 200); assert.equal(sent.length, 0)
  r = await j('POST', '/auth/forgot-password', { email: EMAIL }); assert.equal(r.status, 200)
  const mail = sent.find(m => m.subject.includes('nova senha'))
  assert.ok(mail, 'e-mail de recuperação enviado')
  const resetToken = mail.html.match(/token=([a-f0-9]{64})/)[1]
  assert.ok(mail.html.includes('https://teste.local/admin/redefinir-senha?token='))
  const { rows: stored } = await pool.query('SELECT token_hash FROM password_resets pr JOIN users u ON u.id = pr.user_id WHERE u.email = $1', [EMAIL])
  assert.ok(stored.every(s => s.token_hash !== resetToken), 'token não fica em texto no banco')
  r = await j('GET', `/auth/reset-password/validate?token=${resetToken}`); assert.equal(r.data.valid, true)
  r = await j('POST', '/auth/reset-password', { token: resetToken, new_password: 'curta' }); assert.equal(r.status, 400)
  r = await j('POST', '/auth/reset-password', { token: resetToken, new_password: 'RedefinidaPeloLink1' }); assert.equal(r.status, 200)
  PASSWORD = 'RedefinidaPeloLink1'
  r = await j('POST', '/auth/reset-password', { token: resetToken, new_password: 'OutraSenha123456' }); assert.equal(r.status, 400)
  assert.equal((await j('GET', '/auth/me', null, token)).status, 401)
  r = await j('POST', '/auth/login', { email: EMAIL, password: PASSWORD }); assert.equal(r.status, 200); token = r.data.token
  console.log('✓ recuperação: resposta neutra, link de uso único, token só com hash no banco, sessões encerradas')

  // Link expirado
  await j('POST', '/auth/forgot-password', { email: EMAIL })
  const expiredToken = sent[sent.length - 1].html.match(/token=([a-f0-9]{64})/)[1]
  await pool.query(`UPDATE password_resets SET expires_at = NOW() - INTERVAL '1 minute' WHERE used_at IS NULL`)
  r = await j('POST', '/auth/reset-password', { token: expiredToken, new_password: 'QualquerSenha123' }); assert.equal(r.status, 400)
  console.log('✓ link expirado recusado')

  // 4. Ativar 2FA
  r = await j('POST', '/auth/2fa/setup', { password: 'errada' }, token); assert.equal(r.status, 401)
  r = await j('POST', '/auth/2fa/setup', { password: PASSWORD }, token); assert.equal(r.status, 200)
  assert.ok(r.data.qr_data_url.startsWith('data:image/png;base64,')); assert.ok(r.data.otpauth_url.startsWith('otpauth://totp/'))
  const secret = r.data.secret.replace(/\s/g, '')
  r = await j('POST', '/auth/2fa/enable', { code: '000000' }, token); assert.equal(r.status, 400)
  r = await j('POST', '/auth/2fa/enable', { code: totp.hotp(secret, totp.currentStep()) }, token)
  assert.equal(r.status, 200); assert.equal(r.data.recovery_codes.length, 10)
  const recovery = r.data.recovery_codes
  const { rows: [u] } = await pool.query('SELECT totp_secret FROM users WHERE email = $1', [EMAIL])
  assert.ok(u.totp_secret.startsWith('v1:'), 'segredo criptografado no banco')
  console.log('✓ 2FA ativado com QR code; segredo criptografado; 10 códigos de recuperação')

  // 5. Login com 2FA
  r = await j('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
  assert.equal(r.data.requires_2fa, true); assert.ok(!r.data.token)
  const challenge = r.data.challenge
  assert.equal((await j('GET', '/auth/me', null, challenge)).status, 401, 'desafio não vale como sessão')
  r = await j('POST', '/auth/login/2fa', { challenge, code: '123456' }); assert.equal(r.status, 401)
  const code = totp.hotp(secret, totp.currentStep() + 1)
  r = await j('POST', '/auth/login/2fa', { challenge, code }); assert.equal(r.status, 200); token = r.data.token
  r = await j('POST', '/auth/login/2fa', { challenge, code }); assert.equal(r.status, 401, 'mesmo código não pode ser reutilizado')
  r = await j('POST', '/auth/login/2fa', { challenge: 'invalido', code }); assert.equal(r.data.restart, true)
  console.log('✓ login em 2 etapas; desafio não vale como sessão; código não reutilizável')

  // 6. Código de recuperação (uso único)
  r = await j('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
  r = await j('POST', '/auth/login/2fa', { challenge: r.data.challenge, recovery_code: recovery[0].toLowerCase() })
  assert.equal(r.status, 200); assert.equal(r.data.recovery_codes_left, 9)
  r = await j('POST', '/auth/login', { email: EMAIL, password: PASSWORD })
  r = await j('POST', '/auth/login/2fa', { challenge: r.data.challenge, recovery_code: recovery[0] }); assert.equal(r.status, 401)
  assert.ok(sent.some(m => m.subject.includes('Código de recuperação usado')))
  console.log('✓ código de recuperação: aceita minúsculas, uso único, aviso por e-mail')

  // 7. Novos códigos e desativação
  r = await j('POST', '/auth/2fa/recovery-codes', { password: PASSWORD, code: totp.hotp(secret, totp.currentStep() + 1) }, token)
  // o passo +1 já foi usado no login: precisa de um código "mais novo" -> recusa
  assert.equal(r.status, 401)
  await pool.query('UPDATE users SET totp_last_step = NULL WHERE email = $1', [EMAIL])
  r = await j('POST', '/auth/2fa/recovery-codes', { password: PASSWORD, code: totp.hotp(secret, totp.currentStep()) }, token)
  assert.equal(r.status, 200); assert.equal(r.data.recovery_codes.length, 10)
  r = await j('POST', '/auth/2fa/disable', { password: PASSWORD, recovery_code: recovery[1] }, token)
  assert.equal(r.status, 401, 'códigos antigos foram invalidados')
  console.log('✓ novos códigos de recuperação invalidam os antigos')

  // 8. Recuperação pelo servidor (CLI)
  const { execFileSync } = require('child_process')
  const out = execFileSync('node', [path.join(src, 'cli/admin-recovery.js'), 'disable-2fa', EMAIL], { env: process.env }).toString()
  assert.ok(out.includes('2FA desativado'))
  assert.equal((await j('GET', '/auth/me', null, token)).status, 401, 'CLI encerra sessões')
  r = await j('POST', '/auth/login', { email: EMAIL, password: PASSWORD }); assert.ok(r.data.token, 'login sem 2FA após CLI')
  const out2 = execFileSync('node', [path.join(src, 'cli/admin-recovery.js'), 'reset-link', EMAIL], { env: process.env }).toString()
  const cliToken = out2.match(/token=([a-f0-9]{64})/)[1]
  r = await j('GET', `/auth/reset-password/validate?token=${cliToken}`); assert.equal(r.data.valid, true)
  const out3 = execFileSync('node', [path.join(src, 'cli/admin-recovery.js'), 'temp-password', EMAIL], { env: process.env }).toString()
  const temp = out3.match(/: (\S+)\n/)[1]
  r = await j('POST', '/auth/login', { email: EMAIL, password: temp }); assert.ok(r.data.token)
  console.log('✓ script de servidor: desativar 2FA, gerar link e senha temporária')

  // 9. Desativar pelo painel (senha + código) encerra as outras sessões
  r = await j('POST', '/auth/login', { email: EMAIL, password: temp }); token = r.data.token
  r = await j('POST', '/auth/2fa/setup', { password: temp }, token); const secret2 = r.data.secret.replace(/\s/g, '')
  r = await j('POST', '/auth/2fa/enable', { code: totp.hotp(secret2, totp.currentStep()) }, token)
  const codes2 = r.data.recovery_codes
  r = await j('POST', '/auth/2fa/disable', { password: 'errada', recovery_code: codes2[0] }, token); assert.equal(r.status, 401)
  r = await j('POST', '/auth/2fa/disable', { password: temp, recovery_code: codes2[0] }, token); assert.equal(r.status, 200)
  assert.equal((await j('GET', '/auth/me', null, token)).status, 401)
  assert.equal((await j('GET', '/auth/me', null, r.data.token)).data.user.totp_enabled, false)
  assert.ok(sent.some(m => m.subject.includes('DESATIVADA')))
  console.log('✓ desativar 2FA exige senha + código; encerra sessões; aviso por e-mail')

  const { rows: ev } = await pool.query(`SELECT DISTINCT event FROM auth_events e JOIN users u ON u.id = e.user_id WHERE u.email = $1`, [EMAIL])
  assert.ok(ev.length >= 8)
  console.log(`✓ eventos de segurança registrados (${ev.length} tipos)`)

  srv.close()
  await pool.query('DELETE FROM users WHERE email = $1', [EMAIL])
  await pool.end()
  console.log('\nTODOS OS TESTES PASSARAM')
})().catch(async e => {
  console.error('FALHOU:', e)
  await pool.query('DELETE FROM users WHERE email = $1', [EMAIL]).catch(() => {})
  process.exit(1)
})
