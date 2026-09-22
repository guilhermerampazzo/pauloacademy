'use client'
// v2.1: login em duas etapas quando o 2FA está ativo (senha → código do app ou código de recuperação)
// e link "Esqueci minha senha".
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useForm } from 'react-hook-form'
import { Loader2, Eye, EyeOff, ShieldCheck, ArrowLeft, KeyRound } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import { saveSession, isAuthenticated } from '@/lib/auth'
import AuthShell from '@/components/admin/AuthShell'

type ApiErr = { response?: { status?: number; data?: { error?: string; restart?: boolean } } }
const errMsg = (e: unknown, fallback: string) => (e as ApiErr).response?.data?.error || fallback

export default function LoginPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [showPwd, setShowPwd] = useState(false)
  const [challenge, setChallenge] = useState<string | null>(null)
  const [useRecovery, setUseRecovery] = useState(false)
  const [code, setCode] = useState('')
  const codeRef = useRef<HTMLInputElement>(null)
  const { register, handleSubmit, formState: { errors } } = useForm<{ email: string; password: string }>()

  useEffect(() => {
    if (isAuthenticated()) router.push('/admin')
  }, [router])

  useEffect(() => { if (challenge) setTimeout(() => codeRef.current?.focus(), 50) }, [challenge, useRecovery])

  const finish = (token: string, left?: number) => {
    saveSession(token)
    toast.success('Bem-vindo!')
    if (typeof left === 'number' && left <= 3) toast(`Restam ${left} códigos de recuperação. Gere novos em "Minha senha".`, { icon: '⚠️', duration: 8000 })
    router.push('/admin')
  }

  const onSubmit = async (data: { email: string; password: string }) => {
    setLoading(true)
    try {
      const r = await api.post('/auth/login', data)
      if (r.data.requires_2fa) { setChallenge(r.data.challenge); setCode(''); return }
      finish(r.data.token)
    } catch (e) {
      toast.error((e as ApiErr).response?.status === 429 ? errMsg(e, '') : 'E-mail ou senha incorretos')
    } finally {
      setLoading(false)
    }
  }

  const submitCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!challenge) return
    setLoading(true)
    try {
      const body = useRecovery ? { challenge, recovery_code: code } : { challenge, code: code.replace(/\D/g, '') }
      const r = await api.post('/auth/login/2fa', body)
      finish(r.data.token, r.data.recovery_codes_left)
    } catch (err) {
      const restart = (err as ApiErr).response?.data?.restart
      toast.error(errMsg(err, 'Código inválido'))
      if (restart) { setChallenge(null); setUseRecovery(false) }
      setCode('')
    } finally {
      setLoading(false)
    }
  }

  // Auto-envio ao completar os 6 dígitos
  useEffect(() => {
    if (challenge && !useRecovery && code.replace(/\D/g, '').length === 6 && !loading) {
      submitCode({ preventDefault() {} } as React.FormEvent)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code])

  if (challenge) {
    return (
      <AuthShell title="Verificação em 2 etapas" subtitle={useRecovery
        ? 'Digite um dos códigos de recuperação que você guardou ao ativar o 2FA. Cada código funciona uma única vez.'
        : 'Abra o aplicativo autenticador (Google Authenticator, Microsoft Authenticator, Authy…) e digite o código de 6 dígitos.'}>
        <form onSubmit={submitCode} className="space-y-4">
          <div>
            <label className="label" htmlFor="code">{useRecovery ? 'Código de recuperação' : 'Código do aplicativo'}</label>
            <input
              id="code"
              ref={codeRef}
              value={code}
              onChange={e => setCode(useRecovery ? e.target.value.toUpperCase().slice(0, 12) : e.target.value.replace(/\D/g, '').slice(0, 6))}
              className={`input text-center tracking-[0.4em] font-mono ${useRecovery ? 'text-lg' : 'text-2xl'}`}
              placeholder={useRecovery ? 'XXXX-XXXX' : '000000'}
              inputMode={useRecovery ? 'text' : 'numeric'}
              autoComplete="one-time-code"
            />
          </div>
          <button type="submit" disabled={loading || code.length < 6} className="btn-primary w-full justify-center py-3">
            {loading ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} />} Confirmar
          </button>
          <div className="flex justify-between text-sm pt-1">
            <button type="button" onClick={() => { setChallenge(null); setUseRecovery(false) }} className="text-gray-500 hover:text-gray-800 inline-flex items-center gap-1">
              <ArrowLeft size={14} /> Voltar
            </button>
            <button type="button" onClick={() => { setUseRecovery(!useRecovery); setCode('') }} className="text-accent-700 font-semibold hover:underline inline-flex items-center gap-1">
              <KeyRound size={14} /> {useRecovery ? 'Usar o aplicativo' : 'Perdi o celular'}
            </button>
          </div>
        </form>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Entrar no sistema">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" {...register('email', { required: 'Obrigatório' })} type="email" className="input" placeholder="admin@academypop.com.br" autoComplete="username" />
          {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
        </div>
        <div>
          <div className="flex justify-between items-baseline">
            <label className="label" htmlFor="senha">Senha</label>
            <Link href="/admin/esqueci-senha" className="text-xs font-semibold text-accent-700 hover:underline">Esqueci minha senha</Link>
          </div>
          <div className="relative">
            <input id="senha" {...register('password', { required: 'Obrigatório' })} type={showPwd ? 'text' : 'password'} className="input pr-10" placeholder="••••••••" autoComplete="current-password" />
            <button type="button" onClick={() => setShowPwd(!showPwd)} aria-label={showPwd ? 'Ocultar senha' : 'Mostrar senha'}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3 mt-2">
          {loading ? <><Loader2 size={18} className="animate-spin" /> Entrando...</> : 'Entrar'}
        </button>
      </form>
    </AuthShell>
  )
}
