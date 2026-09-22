'use client'
import { MessageCircle } from 'lucide-react'
import { track } from '@/lib/analytics'
import { whatsappLink } from '@/lib/site'

interface Props {
  number?: string
  message?: string
  /** texto que diz de onde o cliente veio: "página do curso X", "categoria Pós" */
  context?: string
  /** esconde no celular quando há barra de compra fixa */
  hideOnMobile?: boolean
}

// Botão flutuante. A mensagem agora diz de qual página o cliente veio.
export default function WhatsAppButton({ number, message, context, hideOnMobile }: Props) {
  const msg = message || (context
    ? `Olá! Estou vendo ${context} no site da Academy Pop e gostaria de mais informações.`
    : 'Olá! Gostaria de saber mais sobre os cursos da Academy Pop.')
  const href = whatsappLink(number, msg)

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('whatsapp_click', { location: 'botao_flutuante', context: context || 'geral' })}
      className={`fixed bottom-6 right-6 z-40 items-center gap-2 bg-green-500 hover:bg-green-600 text-white font-semibold px-4 py-3 rounded-full shadow-2xl transition-all duration-200 hover:scale-105 ${hideOnMobile ? 'hidden md:flex' : 'flex'}`}
      aria-label="Falar no WhatsApp"
    >
      <MessageCircle size={24} />
      <span className="hidden md:block text-sm">Falar no WhatsApp</span>
    </a>
  )
}
