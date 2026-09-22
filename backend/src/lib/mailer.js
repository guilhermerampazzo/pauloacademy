// Envio de e-mails (recuperação de senha e avisos de segurança) via SMTP.
// Configure no .env: SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, SMTP_FROM (e opcional SMTP_SECURE=true).
// Funciona com qualquer provedor SMTP: Gmail/Google Workspace (senha de app), Brevo, Resend, Amazon SES, Hostinger...
let transporter = null

function isEnabled() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_FROM)
}

function getTransporter() {
  if (!transporter) {
    const nodemailer = require('nodemailer')
    const port = Number(process.env.SMTP_PORT || 587)
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: process.env.SMTP_SECURE ? process.env.SMTP_SECURE === 'true' : port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
    })
  }
  return transporter
}

const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))

function layout(title, bodyHtml) {
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif">
  <table width="100%" cellpadding="0" cellspacing="0" style="padding:24px 0"><tr><td align="center">
  <table width="520" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:12px;overflow:hidden">
    <tr><td style="background:#1e3a8a;color:#fff;padding:18px 24px;font-size:18px;font-weight:bold">Academy<span style="color:#fb923c">Pop</span> · Painel</td></tr>
    <tr><td style="padding:24px;color:#111827;font-size:15px;line-height:1.5">
      <h1 style="font-size:18px;margin:0 0 12px">${esc(title)}</h1>${bodyHtml}
    </td></tr>
    <tr><td style="padding:16px 24px;color:#6b7280;font-size:12px;border-top:1px solid #e5e7eb">
      Mensagem automática de segurança. Se você não reconhece esta ação, troque sua senha e avise o responsável técnico.
    </td></tr>
  </table></td></tr></table></body></html>`
}

async function send({ to, subject, title, html, text }) {
  if (!isEnabled()) {
    console.warn(`[e-mail] SMTP não configurado – mensagem "${subject}" para ${to} NÃO enviada`)
    return false
  }
  try {
    await getTransporter().sendMail({ from: process.env.SMTP_FROM, to, subject, text, html: layout(title || subject, html) })
    return true
  } catch (err) {
    console.error('[e-mail] falha ao enviar:', err.message)
    return false
  }
}

module.exports = { isEnabled, send, esc }
