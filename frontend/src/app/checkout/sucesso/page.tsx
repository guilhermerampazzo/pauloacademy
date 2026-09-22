'use client'
import { Suspense, useEffect, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { CheckCircle, ArrowLeft, Loader2, Clock } from 'lucide-react'
import { track } from '@/lib/analytics'

// Retorno do cartão (Mercado Pago). Consulta o status real do pedido em vez de
// afirmar "Pagamento Confirmado" sem checar (antes).
function Inner() {
  const params = useSearchParams()
  const id = params.get('pedido')
  const token = params.get('t')
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!id || !token) return
    let tries = 0
    const check = async () => {
      try {
        const r = await fetch(`/api/orders/${id}/public-status?t=${token}`)
        const d = await r.json()
        setStatus(d.status || 'pending')
        if (d.status === 'paid') {
          const key = `ap_purchase_${id}`
          if (!sessionStorage.getItem(key)) {
            sessionStorage.setItem(key, '1')
            track('purchase', { transaction_id: String(id), currency: 'BRL', value: Number(d.amount) })
          }
          return true
        }
      } catch { /* ignore */ }
      return false
    }
    check()
    const t = setInterval(async () => { tries++; if ((await check()) || tries > 24) clearInterval(t) }, 5000)
    return () => clearInterval(t)
  }, [id, token])

  const paid = status === 'paid' || (!id && !token)
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        {paid ? (
          <>
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle size={40} className="text-green-500" /></div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">{id ? 'Pagamento confirmado!' : 'Pedido recebido!'}</h1>
            <p className="text-gray-600 mb-8">Sua matrícula foi registrada{id ? ` (pedido #${id})` : ''}. Em breve você recebe as instruções de acesso por e-mail e WhatsApp.</p>
          </>
        ) : (
          <>
            <div className="w-20 h-20 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-6">
              {status === null ? <Loader2 size={36} className="animate-spin text-yellow-600" /> : <Clock size={36} className="text-yellow-600" />}
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento em análise</h1>
            <p className="text-gray-600 mb-8">Pedido #{id}. Assim que o Mercado Pago aprovar, sua matrícula é confirmada automaticamente. Esta página se atualiza sozinha.</p>
          </>
        )}
        <Link href="/" className="btn-primary w-full justify-center"><ArrowLeft size={18} /> Voltar ao início</Link>
      </div>
    </div>
  )
}

export default function SucessoPage() {
  return <Suspense fallback={null}><Inner /></Suspense>
}
