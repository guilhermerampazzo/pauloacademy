'use client'
// v2.1: pedido de link para criar nova senha (enviado por e-mail, vale 30 min)
import { useState } from 'react'
import Link from 'next/link'
import { Loader2, MailCheck, ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import AuthShell from '@/components/admin/AuthShell'

export default function EsqueciSenhaPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error('Informe um e-mail válido'); return }
    setLoading(true)
    try {
      const r = await api.post('/auth/forgot-password', { email })
      setDone(r.data.message)
    } catch (err) {
      toast.error((err as { response?: { data?: { error?: string } } }).response?.data?.error || 'Tente novamente em instantes')
    } finally { setLoading(false) }
  }

  if (done) {
    return (
      <AuthShell title="Verifique seu e-mail">
        <div className="text-center">
          <MailCheck size={48} className="mx-auto text-green-500 mb-4" />
          <p className="text-gray-700">{done}</p>
          <p className="text-sm text-gray-500 mt-3">Não chegou? Confira a caixa de spam. O link vale por 30 minutos.</p>
          <p className="text-xs text-gray-400 mt-4">Sem acesso ao e-mail? O responsável técnico pode liberar o acesso pelo servidor.</p>
          <Link href="/admin/login" className="btn-secondary w-full justify-center mt-6"><ArrowLeft size={16} /> Voltar ao login</Link>
        </div>
      </AuthShell>
    )
  }

  return (
    <AuthShell title="Esqueci minha senha" subtitle="Informe o e-mail do seu acesso ao painel. Enviaremos um link para você criar uma nova senha.">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label" htmlFor="email">E-mail</label>
          <input id="email" type="email" value={email} onChange={e => setEmail(e.target.value)} className="input" autoComplete="username" autoFocus />
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-3">
          {loading ? <Loader2 size={18} className="animate-spin" /> : null} Enviar link
        </button>
        <Link href="/admin/login" className="block text-center text-sm text-gray-500 hover:text-gray-800">Voltar ao login</Link>
      </form>
    </AuthShell>
  )
}
