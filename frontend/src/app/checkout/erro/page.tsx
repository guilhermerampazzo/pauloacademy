import Link from 'next/link'
import { XCircle, ArrowLeft, MessageCircle } from 'lucide-react'

async function getWhatsApp() {
  const base = process.env.INTERNAL_API_URL || 'http://backend:3001'
  try {
    const res = await fetch(`${base}/content`, { next: { revalidate: 300 } })
    if (!res.ok) return null
    const data = await res.json()
    return (data.footer?.whatsapp as string) || null
  } catch { return null }
}

export default async function ErroPage() {
  const whatsapp = await getWhatsApp() || process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || ''

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl shadow-lg p-10 max-w-md w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
          <XCircle size={40} className="text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Pagamento não processado</h1>
        <p className="text-gray-600 mb-8">
          Houve um problema com seu pagamento. Tente novamente ou entre em contato pelo WhatsApp.
        </p>
        <div className="flex flex-col gap-3">
          <Link href="/" className="btn-secondary w-full justify-center">
            <ArrowLeft size={18} /> Voltar ao início
          </Link>
          <a
            href={`https://wa.me/${whatsapp}`}
            target="_blank" rel="noopener noreferrer"
            className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg transition-colors"
          >
            <MessageCircle size={18} /> Falar no WhatsApp
          </a>
        </div>
      </div>
    </div>
  )
}
