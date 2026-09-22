'use client'
// v2.1: criação da nova senha a partir do link recebido por e-mail
import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Loader2, CheckCircle, XCircle, Eye, EyeOff } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import AuthShell from '@/components/admin/AuthShell'
import PasswordStrength from '@/components/admin/PasswordStrength'

function Inner() {
  const router = useRouter()
  const token = useSearchParams().get('token') || ''
  const [state, setState] = useState<'checking' | 'valid' | 'invalid' | 'done'>('checking')
  const [info, setInfo] = useState<{ email?: string; totp_enabled?: boolean }>({})
  const [pwd, setPwd] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!token) { setState('invalid'); return }
    api.get(`/auth/reset-password/validate?token=${encodeURIComponent(token)}`)
      .then(r => { setState(r.data.valid ? 'valid' : 'invalid'); setInfo(r.data) })
      .catch(() => setState('invalid'))
  }, [token])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pwd.length < 10) { toast.error('Use pelo menos 10 caracteres'); return }
    if (pwd !== confirm) { toast.error('A confirmação não confere'); return }
    setLoading(true)
    try {
      const r = await api.post('/auth/reset-password', { token, new_password: pwd })
      setMessage(r.data.message); setState('done')
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Não foi possível redefinir')
    } finally { setLoading(false) }
  }

  if (state === 'checking') return <AuthShell title="Criar nova senha"><div className="flex justify-center py-6"><Loader2 className="animate-spin text-primary-500" /></div></AuthShell>

  if (state === 'invalid') {
    return (
      <AuthShell title="Link inválido ou expirado">
        <div className="text-center">
          <XCircle size={48} className="mx-auto text-red-500 mb-4" />
          <p className="text-gray-700">Este link já foi usado ou passou do prazo de 30 minutos.</p>
          <Link href="/admin/esqueci-senha" className="btn-primary w-full justify-center mt-6">Pedir um novo link</Link>
        </div>
      </AuthShell>
    )
  }

  if (state === 'done') {
    return (
      <AuthShell title="Senha redefinida">
        <div className="text-center">
          <CheckCircle size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-gray-700">{message}</p>
          <button onClick={() => router.push('/admin/login')} className="btn-primary w-full justify-center mt-6">Ir para o login</button>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Criar nova senha" subtitle={`Conta ${info.email || ''}. Todas as sessões abertas serão encerradas.`}>
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="nova">Nova senha</label>
          <div className="relative">
            <input id="nova" type={show ? 'text' : 'password'} value={pwd} onChange={e => setPwd(e.target.value)} className="input pr-10" autoComplete="new-password" autoFocus />
            <button type="button" onClick={() => setShow(!show)} aria-label={show ? 'Ocultar senha' : 'Mostrar senha'} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">{show ? <EyeOff size={18} /> : <Eye size={18} />}</button>
          </div>
          <PasswordStrength value={pwd} />
        </div>
        <div>
          <label className="label" htmlFor="conf">Confirmar nova senha</label>
          <input id="conf" type={show ? 'text' : 'password'} value={confirm} onChange={e => setConfirm(e.target.value)} className="input" autoComplete="new-password" />
        </div>
        {info.totp_enabled && <p className="text-xs text-gray-500">Sua conta usa verificação em 2 etapas: no próximo login, o código do aplicativo continuará sendo pedido.</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading ? <Loader2 size={18} className="animate-spin" /> : null} Salvar nova senha
        </button>
      </form>
    </AuthShell>
  )
}

export default function RedefinirSenhaPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
