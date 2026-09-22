'use client'
// v2.1: "Segurança da conta" – troca de senha, verificação em 2 etapas (2FA) e histórico de acessos
import { useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, KeyRound, ShieldCheck, ShieldOff, Copy, Download, RefreshCw, History, AlertTriangle, Mail } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { saveSession } from '@/lib/auth'
import PasswordStrength from '@/components/admin/PasswordStrength'

type Me = { email: string; name: string; totp_enabled: boolean; recovery_codes_left: number; password_changed_at?: string; last_login_at?: string }
type Ev = { event: string; ip: string; user_agent: string; created_at: string }
const errMsg = (e: unknown, f: string) => (e as { response?: { data?: { error?: string } } }).response?.data?.error || f

const EVENT_LABEL: Record<string, string> = {
  login_success: 'Login', login_success_2fa: 'Login com 2FA', login_failed: 'Senha errada',
  login_password_ok_2fa_pending: 'Senha certa, aguardando código', '2fa_failed': 'Código 2FA errado',
  '2fa_recovery_used': 'Login com código de recuperação', '2fa_recovery_failed': 'Código de recuperação errado',
  '2fa_enabled': '2FA ativado', '2fa_disabled': '2FA desativado', '2fa_disabled_cli': '2FA desativado pelo servidor',
  '2fa_recovery_regenerated': 'Novos códigos de recuperação', password_changed: 'Senha alterada',
  password_change_failed: 'Tentativa de troca de senha', password_reset_requested: 'Pedido de nova senha',
  password_reset_done: 'Senha redefinida pelo link', password_reset_link_cli: 'Link gerado pelo servidor',
  password_temp_cli: 'Senha temporária pelo servidor',
}

function RecoveryCodes({ codes, onClose }: { codes: string[]; onClose: () => void }) {
  const text = `Academy Pop – códigos de recuperação do painel\nCada código funciona uma única vez.\n\n${codes.join('\n')}\n`
  const download = () => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob([text], { type: 'text/plain' }))
    a.download = 'academypop-codigos-recuperacao.txt'
    a.click()
  }
  return (
    <div className="border-2 border-amber-300 bg-amber-50 rounded-xl p-5">
      <p className="font-bold text-amber-900 flex items-center gap-2"><AlertTriangle size={18} /> Guarde estes códigos agora</p>
      <p className="text-sm text-amber-800 mt-1 mb-4">Eles permitem entrar se você perder o celular. Não serão mostrados de novo. Guarde num gerenciador de senhas ou impresso em local seguro.</p>
      <div className="grid grid-cols-2 gap-2 font-mono text-center text-sm bg-white rounded-lg p-4 border border-amber-200">
        {codes.map(c => <span key={c}>{c}</span>)}
      </div>
      <div className="flex flex-wrap gap-2 mt-4">
        <button onClick={() => { navigator.clipboard.writeText(text); toast.success('Copiado') }} className="btn-secondary py-2 text-sm"><Copy size={14} /> Copiar</button>
        <button onClick={download} className="btn-secondary py-2 text-sm"><Download size={14} /> Baixar .txt</button>
        <button onClick={onClose} className="btn-primary py-2 text-sm">Já guardei</button>
      </div>
    </div>
  )
}

export default function SegurancaPage() {
  const [me, setMe] = useState<Me | null>(null)
  const [emailEnabled, setEmailEnabled] = useState(true)
  const [events, setEvents] = useState<Ev[]>([])

  // troca de senha
  const [current, setCurrent] = useState('')
  const [next, setNext] = useState('')
  const [confirm, setConfirm] = useState('')
  const [saving, setSaving] = useState(false)

  // 2FA
  const [step, setStep] = useState<'idle' | 'password' | 'scan' | 'codes' | 'disable' | 'regen'>('idle')
  const [pwd2, setPwd2] = useState('')
  const [code2, setCode2] = useState('')
  const [setup, setSetup] = useState<{ secret: string; qr_data_url: string } | null>(null)
  const [codes, setCodes] = useState<string[]>([])
  const [busy, setBusy] = useState(false)

  const load = () => {
    api.get('/auth/me').then(r => { setMe(r.data.user); setEmailEnabled(r.data.email_enabled) }).catch(() => {})
    api.get('/auth/events').then(r => setEvents(r.data)).catch(() => {})
  }
  useEffect(load, [])

  const reset2 = () => { setPwd2(''); setCode2(''); setSetup(null) }

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault()
    if (next.length < 10) { toast.error('A nova senha precisa ter pelo menos 10 caracteres'); return }
    if (next !== confirm) { toast.error('A confirmação não confere'); return }
    setSaving(true)
    try {
      const r = await api.post('/auth/change-password', { current_password: current, new_password: next })
      if (r.data.token) saveSession(r.data.token)
      toast.success('Senha alterada. As outras sessões foram encerradas.')
      setCurrent(''); setNext(''); setConfirm(''); load()
    } catch (err) { toast.error(errMsg(err, 'Não foi possível alterar a senha')) } finally { setSaving(false) }
  }

  const startSetup = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api.post('/auth/2fa/setup', { password: pwd2 })
      setSetup(r.data); setStep('scan'); setPwd2('')
    } catch (err) { toast.error(errMsg(err, 'Não foi possível iniciar')) } finally { setBusy(false) }
  }

  const enable = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api.post('/auth/2fa/enable', { code: code2 })
      setCodes(r.data.recovery_codes); setStep('codes'); reset2(); toast.success('Verificação em 2 etapas ativada'); load()
    } catch (err) { toast.error(errMsg(err, 'Código inválido')) } finally { setBusy(false) }
  }

  const disable = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const isRecovery = /[A-Za-z]/.test(code2)
      const r = await api.post('/auth/2fa/disable', { password: pwd2, ...(isRecovery ? { recovery_code: code2 } : { code: code2 }) })
      if (r.data.token) saveSession(r.data.token)
      toast.success('2FA desativado'); setStep('idle'); reset2(); load()
    } catch (err) { toast.error(errMsg(err, 'Não foi possível desativar')) } finally { setBusy(false) }
  }

  const regen = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true)
    try {
      const r = await api.post('/auth/2fa/recovery-codes', { password: pwd2, code: code2 })
      setCodes(r.data.recovery_codes); setStep('codes'); reset2(); load()
    } catch (err) { toast.error(errMsg(err, 'Não foi possível gerar')) } finally { setBusy(false) }
  }

  const pwdInput = (id: string) => (
    <div><label className="label" htmlFor={id}>Sua senha atual</label>
      <input id={id} type="password" autoComplete="current-password" className="input" value={pwd2} onChange={e => setPwd2(e.target.value)} /></div>
  )

  return (
    <div className="p-8 max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2"><ShieldCheck size={24} /> Segurança da conta</h1>
        <p className="text-gray-500">{me?.email}</p>
      </div>

      {!emailEnabled && (
        <div className="flex gap-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-xl p-4 text-sm">
          <Mail size={18} className="shrink-0 mt-0.5" />
          <p>O envio de e-mails (SMTP) não está configurado no servidor. Enquanto isso, &quot;Esqueci minha senha&quot; e os avisos de segurança não chegam. Peça ao responsável técnico para configurar.</p>
        </div>
      )}

      {/* ---------------- 2FA ---------------- */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-bold text-gray-900">Verificação em 2 etapas (2FA)</h2>
            <p className="text-sm text-gray-500 mt-1">Além da senha, o login pede um código de 6 dígitos gerado no seu celular. Mesmo que alguém descubra a senha, não entra sem o celular.</p>
          </div>
          {me && (me.totp_enabled
            ? <span className="badge bg-green-100 text-green-700 shrink-0"><ShieldCheck size={12} className="mr-1" /> Ativada</span>
            : <span className="badge bg-red-100 text-red-700 shrink-0"><ShieldOff size={12} className="mr-1" /> Desativada</span>)}
        </div>

        <div className="mt-5 space-y-4">
          {step === 'codes' && <RecoveryCodes codes={codes} onClose={() => { setStep('idle'); setCodes([]) }} />}

          {step === 'idle' && me && !me.totp_enabled && (
            <button onClick={() => setStep('password')} className="btn-primary"><ShieldCheck size={16} /> Ativar verificação em 2 etapas</button>
          )}

          {step === 'idle' && me?.totp_enabled && (
            <>
              <p className={`text-sm ${me.recovery_codes_left <= 3 ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                Códigos de recuperação disponíveis: {me.recovery_codes_left} de 10
              </p>
              <div className="flex flex-wrap gap-2">
                <button onClick={() => setStep('regen')} className="btn-secondary py-2 text-sm"><RefreshCw size={14} /> Gerar novos códigos de recuperação</button>
                <button onClick={() => setStep('disable')} className="py-2 px-4 text-sm rounded-lg border-2 border-red-200 text-red-600 hover:bg-red-50 font-semibold">Desativar 2FA</button>
              </div>
            </>
          )}

          {step === 'password' && (
            <form onSubmit={startSetup} className="space-y-3 max-w-sm">
              <p className="text-sm text-gray-600">1. Instale um aplicativo autenticador no celular (Google Authenticator, Microsoft Authenticator ou Authy).</p>
              {pwdInput('pwd-setup')}
              <div className="flex gap-2">
                <button type="submit" disabled={busy || !pwd2} className="btn-primary py-2">{busy && <Loader2 size={14} className="animate-spin" />} Continuar</button>
                <button type="button" onClick={() => { setStep('idle'); reset2() }} className="btn-secondary py-2">Cancelar</button>
              </div>
            </form>
          )}

          {step === 'scan' && setup && (
            <form onSubmit={enable} className="grid grid-cols-1 sm:grid-cols-[220px_1fr] gap-6 items-start">
              <div className="border border-gray-200 rounded-xl p-2 bg-white w-fit">
                <Image src={setup.qr_data_url} alt="QR code para o aplicativo autenticador" width={220} height={220} unoptimized />
              </div>
              <div className="space-y-3">
                <p className="text-sm text-gray-600">2. No aplicativo, toque em <b>adicionar conta</b> e escaneie o QR code.</p>
                <p className="text-xs text-gray-500">Não consegue escanear? Digite a chave manualmente:<br />
                  <code className="font-mono text-sm text-gray-800 break-all select-all">{setup.secret}</code></p>
                <div>
                  <label className="label" htmlFor="code-enable">3. Digite o código de 6 dígitos que aparece no app</label>
                  <input id="code-enable" value={code2} onChange={e => setCode2(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    className="input text-center text-2xl tracking-[0.4em] font-mono w-48" inputMode="numeric" autoComplete="one-time-code" placeholder="000000" autoFocus />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={busy || code2.length !== 6} className="btn-primary py-2">{busy && <Loader2 size={14} className="animate-spin" />} Ativar</button>
                  <button type="button" onClick={() => { setStep('idle'); reset2() }} className="btn-secondary py-2">Cancelar</button>
                </div>
              </div>
            </form>
          )}

          {(step === 'disable' || step === 'regen') && (
            <form onSubmit={step === 'disable' ? disable : regen} className="space-y-3 max-w-sm">
              <p className="text-sm text-gray-600">
                {step === 'disable'
                  ? 'Para desativar, confirme a senha e um código do aplicativo (ou um código de recuperação). As outras sessões serão encerradas.'
                  : 'Os códigos antigos deixarão de funcionar. Confirme a senha e um código do aplicativo.'}
              </p>
              {pwdInput('pwd-2fa')}
              <div>
                <label className="label" htmlFor="code-2fa">{step === 'disable' ? 'Código do app ou de recuperação' : 'Código do aplicativo'}</label>
                <input id="code-2fa" value={code2} onChange={e => setCode2(e.target.value.toUpperCase().slice(0, 12))} className="input font-mono" inputMode={step === 'regen' ? 'numeric' : 'text'} autoComplete="one-time-code" />
              </div>
              <div className="flex gap-2">
                <button type="submit" disabled={busy || !pwd2 || code2.length < 6}
                  className={step === 'disable' ? 'py-2 px-4 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold inline-flex items-center gap-2 disabled:opacity-50' : 'btn-primary py-2'}>
                  {busy && <Loader2 size={14} className="animate-spin" />} {step === 'disable' ? 'Desativar 2FA' : 'Gerar novos códigos'}
                </button>
                <button type="button" onClick={() => { setStep('idle'); reset2() }} className="btn-secondary py-2">Cancelar</button>
              </div>
            </form>
          )}
        </div>
      </section>

      {/* ---------------- Senha ---------------- */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 flex items-center gap-2"><KeyRound size={18} /> Trocar senha</h2>
        <p className="text-sm text-gray-500 mt-1 mb-4">
          {me?.password_changed_at ? `Última troca em ${new Date(me.password_changed_at).toLocaleDateString('pt-BR')}. ` : ''}
          Ao trocar, as outras sessões abertas são encerradas.
        </p>
        <form onSubmit={changePassword} className="space-y-4 max-w-sm">
          <div><label className="label" htmlFor="atual">Senha atual</label><input id="atual" type="password" autoComplete="current-password" className="input" value={current} onChange={e => setCurrent(e.target.value)} /></div>
          <div><label className="label" htmlFor="nova">Nova senha</label><input id="nova" type="password" autoComplete="new-password" className="input" value={next} onChange={e => setNext(e.target.value)} /><PasswordStrength value={next} /></div>
          <div><label className="label" htmlFor="conf">Confirmar nova senha</label><input id="conf" type="password" autoComplete="new-password" className="input" value={confirm} onChange={e => setConfirm(e.target.value)} /></div>
          <button type="submit" disabled={saving} className="btn-primary">{saving ? <Loader2 size={16} className="animate-spin" /> : null} Alterar senha</button>
        </form>
      </section>

      {/* ---------------- Histórico ---------------- */}
      <section className="bg-white rounded-2xl border border-gray-100 p-6">
        <h2 className="font-bold text-gray-900 flex items-center gap-2 mb-4"><History size={18} /> Atividade recente da conta</h2>
        {events.length === 0 ? <p className="text-sm text-gray-400">Sem registros ainda.</p> : (
          <ul className="divide-y divide-gray-50 text-sm">
            {events.map((e, i) => (
              <li key={i} className="py-2 flex justify-between gap-4">
                <span className={/failed|disabled/.test(e.event) ? 'text-red-600' : 'text-gray-700'}>{EVENT_LABEL[e.event] || e.event}</span>
                <span className="text-gray-400 text-xs text-right">{new Date(e.created_at).toLocaleString('pt-BR')} · {e.ip}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
