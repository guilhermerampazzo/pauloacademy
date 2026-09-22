'use client'
// Checkout único (v2): paga 1 ou vários cursos numa só cobrança.
// /checkout            -> cursos do carrinho
// /checkout?curso=ID   -> "Matricular agora": só aquele curso (o carrinho não é alterado)
import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import toast from 'react-hot-toast'
import {
  Tag, CheckCircle, ArrowLeft, Loader2, Copy, ExternalLink, QrCode, CreditCard, Barcode,
  ShieldCheck, MessageCircle, AlertCircle, Trash2, Lock,
} from 'lucide-react'
import { useCart, fetchQuote, type Quote } from '@/lib/cart'
import { brl } from '@/lib/site'
import { track } from '@/lib/analytics'

function isValidCPF(value?: string) {
  const cpf = String(value || '').replace(/\D/g, '')
  if (cpf.length !== 11 || /^(\d)\1{10}$/.test(cpf)) return false
  const calc = (len: number) => {
    let sum = 0
    for (let i = 0; i < len; i++) sum += Number(cpf[i]) * (len + 1 - i)
    const r = (sum * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(cpf[9]) && calc(10) === Number(cpf[10])
}

const schema = z.object({
  customer_name: z.string().trim().min(3, 'Informe seu nome completo').refine(v => v.split(/\s+/).length >= 2, 'Informe nome e sobrenome'),
  customer_email: z.string().trim().email('E-mail inválido'),
  customer_phone: z.string().refine(v => v.replace(/\D/g, '').length >= 10, 'Telefone com DDD'),
  customer_cpf: z.string().optional(),
  payment_method: z.enum(['pix', 'credit_card', 'boleto']),
}).refine(d => d.payment_method !== 'boleto' || isValidCPF(d.customer_cpf), { path: ['customer_cpf'], message: 'CPF inválido' })

type FormData = z.infer<typeof schema>

interface OrderResult {
  order: { id: number; amount: number; status: string; access_token: string }
  mode: 'mercadopago' | 'whatsapp' | 'error'
  payment_url?: string
  pix_qr_code?: string
  pix_qr_code_base64?: string
  boleto_url?: string
  boleto_barcode?: string
  whatsapp_fallback?: string | null
  error?: string
}

const maskPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 10) return d.replace(/(\d{2})(\d{0,4})(\d{0,4})/, (_, a, b, c) => [a && `(${a}`, a && a.length === 2 ? ') ' : '', b, c && `-${c}`].join(''))
  return d.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3')
}
const maskCPF = (v: string) => v.replace(/\D/g, '').slice(0, 11)
  .replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')

function CheckoutInner() {
  const params = useSearchParams()
  const single = Number(params.get('curso')) || null
  const cart = useCart()

  const courseIds = single ? [single] : cart.items.map(i => i.course_id)
  const idsKey = courseIds.join(',')

  const [quote, setQuote] = useState<Quote | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(true)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<OrderResult | null>(null)
  const [paid, setPaid] = useState(false)
  const trackedRef = useRef(false)

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { payment_method: 'pix' },
  })
  const paymentMethod = watch('payment_method')

  const loadQuote = useCallback(async () => {
    if (!idsKey) { setQuote(null); setQuoteLoading(false); return }
    setQuoteLoading(true)
    try {
      const q = await fetchQuote(idsKey.split(',').map(Number), coupon, paymentMethod)
      setQuote(q)
      if (!trackedRef.current && q.items.length) {
        trackedRef.current = true
        track('begin_checkout', { currency: 'BRL', value: q.total, items: q.items.map(i => ({ item_id: String(i.course_id), item_name: i.title, price: i.final_price })) })
      }
    } catch {
      toast.error('Não foi possível calcular o pedido')
    } finally {
      setQuoteLoading(false)
    }
  }, [idsKey, coupon, paymentMethod])

  useEffect(() => { if (single || cart.ready) loadQuote() }, [loadQuote, single, cart.ready])

  useEffect(() => {
    if (!quote || !coupon) return
    if (quote.couponError) toast.error(quote.couponError)
    else if (quote.coupon) toast.success(`Cupom ${quote.coupon.code} aplicado: ${quote.coupon.discount_percent}% de desconto`)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quote?.coupon?.code, quote?.couponError, coupon])

  // Consulta o status do pedido (PIX/boleto) até ser aprovado
  useEffect(() => {
    if (!result || result.mode !== 'mercadopago' || paid || !(result.pix_qr_code || result.boleto_url)) return
    const id = setInterval(async () => {
      try {
        const r = await fetch(`/api/orders/${result.order.id}/public-status?t=${result.order.access_token}`)
        const data = await r.json()
        if (data.status === 'paid') {
          setPaid(true)
          track('purchase', { transaction_id: String(result.order.id), currency: 'BRL', value: Number(result.order.amount) })
        }
      } catch { /* tenta de novo */ }
    }, 5000)
    return () => clearInterval(id)
  }, [result, paid])

  const onSubmit = async (data: FormData) => {
    if (!quote?.items.length) return
    setSubmitting(true)
    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          course_ids: quote.items.map(i => i.course_id),
          coupon_code: quote.coupon?.code,
          ...data,
          customer_cpf: data.customer_cpf?.replace(/\D/g, ''),
        }),
      })
      const r: OrderResult & { error?: string } = await res.json()

      if (res.status === 400 || res.status === 429) { toast.error(r.error || 'Verifique os dados'); return }

      if (r.mode === 'error' || res.status >= 500) {
        setResult({ ...r, mode: 'error' })
        return
      }

      // Pedido criado: o carrinho pode ser esvaziado (se veio dele)
      if (!single) cart.clear()

      if (r.mode === 'whatsapp') {
        window.location.href = r.whatsapp_fallback || '/'
        return
      }
      if (data.payment_method === 'credit_card' && r.payment_url) {
        window.location.href = r.payment_url
        return
      }
      setResult(r)
      window.scrollTo({ top: 0 })
    } catch {
      toast.error('Erro ao processar o pedido. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copiado!') }

  // ---------- Tela de resultado ----------
  if (result) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-8 max-w-lg w-full text-center">
          {paid ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><CheckCircle size={32} className="text-green-600" /></div>
              <h1 className="text-2xl font-black text-gray-900 mb-2">Pagamento confirmado!</h1>
              <p className="text-gray-600 mb-6">Pedido #{result.order.id}. Em breve você recebe as instruções de acesso por e-mail e WhatsApp.</p>
            </>
          ) : result.mode === 'error' ? (
            <>
              <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4"><AlertCircle size={32} className="text-red-600" /></div>
              <h1 className="text-2xl font-black text-gray-900 mb-2">Não conseguimos gerar o pagamento</h1>
              <p className="text-gray-600 mb-6">{result.error}</p>
              <div className="flex flex-col gap-3">
                <button onClick={() => setResult(null)} className="btn-secondary w-full justify-center">Tentar outra forma de pagamento</button>
                {result.whatsapp_fallback && (
                  <a href={result.whatsapp_fallback} className="flex items-center justify-center gap-2 w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-lg">
                    <MessageCircle size={18} /> Concluir pelo WhatsApp
                  </a>
                )}
              </div>
            </>
          ) : result.pix_qr_code ? (
            <>
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4"><QrCode size={30} className="text-green-600" /></div>
              <h1 className="text-2xl font-black text-gray-900 mb-1">Pague com PIX</h1>
              <p className="text-gray-500 mb-1">Pedido #{result.order.id} · <strong>{brl(result.order.amount)}</strong></p>
              <p className="text-gray-500 mb-6 text-sm">Escaneie o QR code ou copie o código abaixo</p>
              {result.pix_qr_code_base64 && (
                <div className="flex justify-center mb-4">
                  <Image src={`data:image/png;base64,${result.pix_qr_code_base64}`} alt="QR Code PIX" width={200} height={200} className="rounded-lg border" unoptimized />
                </div>
              )}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-left">
                <p className="text-xs text-gray-500 mb-1">Código Pix Copia e Cola:</p>
                <p className="text-xs font-mono text-gray-700 break-all">{result.pix_qr_code}</p>
              </div>
              <button onClick={() => copy(result.pix_qr_code!)} className="flex items-center gap-2 justify-center w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 rounded-xl transition-colors mb-3">
                <Copy size={18} /> Copiar código PIX
              </button>
              <p className="text-xs text-gray-500 flex items-center justify-center gap-2"><Loader2 size={12} className="animate-spin" /> Aguardando o pagamento. Esta tela atualiza sozinha.</p>
            </>
          ) : result.boleto_url ? (
            <>
              <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-4"><Barcode size={30} className="text-yellow-600" /></div>
              <h1 className="text-2xl font-black text-gray-900 mb-1">Boleto gerado!</h1>
              <p className="text-gray-500 mb-6">Pedido #{result.order.id} · {brl(result.order.amount)}. Vence em 3 dias úteis.</p>
              {result.boleto_barcode && (
                <>
                  <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 mb-4 text-left">
                    <p className="text-xs text-gray-500 mb-1">Linha digitável:</p>
                    <p className="text-sm font-mono text-gray-700 break-all">{result.boleto_barcode}</p>
                  </div>
                  <button onClick={() => copy(result.boleto_barcode!)} className="flex items-center gap-2 justify-center w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-3 rounded-xl transition-colors mb-3">
                    <Copy size={18} /> Copiar código do boleto
                  </button>
                </>
              )}
              <a href={result.boleto_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 justify-center w-full bg-primary-600 hover:bg-primary-700 text-white font-semibold py-3 rounded-xl transition-colors">
                <ExternalLink size={18} /> Abrir / imprimir boleto
              </a>
            </>
          ) : null}
          <Link href="/" className="inline-flex items-center gap-1 mt-6 text-sm text-gray-400 hover:text-gray-600"><ArrowLeft size={14} /> Voltar ao início</Link>
        </div>
      </div>
    )
  }

  // ---------- Carrinho vazio ----------
  if (!quoteLoading && (!quote || quote.items.length === 0)) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-10 max-w-md w-full text-center">
          <h1 className="text-xl font-bold text-gray-900 mb-2">Nenhum curso para pagar</h1>
          <p className="text-gray-500 mb-6">
            {quote?.unavailable.length ? 'Os cursos escolhidos não estão disponíveis para compra online. Fale com um consultor.' : 'Seu carrinho está vazio.'}
          </p>
          <Link href="/cursos" className="btn-primary">Ver cursos</Link>
        </div>
      </div>
    )
  }

  const itemsCount = quote?.items.length || 0

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-primary-900 text-white py-4 px-4">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <Link href={single ? '/' : '/carrinho'} className="text-blue-300 hover:text-white" aria-label="Voltar"><ArrowLeft size={20} /></Link>
          <span className="font-semibold flex items-center gap-2"><Lock size={16} /> Checkout seguro</span>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 py-8 md:py-10">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
          {/* Formulário */}
          <div className="lg:col-span-3 order-2 lg:order-1">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8">
              <h1 className="text-xl font-bold text-primary-900 mb-6">Seus dados</h1>
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
                <div>
                  <label className="label" htmlFor="nome">Nome completo *</label>
                  <input id="nome" {...register('customer_name')} className="input" placeholder="Seu nome completo" autoComplete="name" />
                  {errors.customer_name && <p className="text-red-500 text-xs mt-1">{errors.customer_name.message}</p>}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="label" htmlFor="email">E-mail *</label>
                    <input id="email" {...register('customer_email')} type="email" className="input" placeholder="seu@email.com" autoComplete="email" inputMode="email" />
                    {errors.customer_email && <p className="text-red-500 text-xs mt-1">{errors.customer_email.message}</p>}
                  </div>
                  <div>
                    <label className="label" htmlFor="tel">Telefone/WhatsApp *</label>
                    <input id="tel" {...register('customer_phone', { onChange: e => setValue('customer_phone', maskPhone(e.target.value)) })}
                      className="input" placeholder="(61) 99999-9999" autoComplete="tel" inputMode="tel" />
                    {errors.customer_phone && <p className="text-red-500 text-xs mt-1">{errors.customer_phone.message}</p>}
                  </div>
                </div>

                <div>
                  <span className="label">Forma de pagamento *</span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-1">
                    {[
                      { value: 'pix', label: 'PIX', desc: 'Aprovação na hora', icon: <QrCode size={22} /> },
                      { value: 'credit_card', label: 'Cartão', desc: `até ${quote?.maxInstallments || 12}x`, icon: <CreditCard size={22} /> },
                      { value: 'boleto', label: 'Boleto', desc: 'Vence em 3 dias úteis', icon: <Barcode size={22} /> },
                    ].map(opt => (
                      <label key={opt.value}
                        className={`flex items-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === opt.value ? 'border-primary-600 bg-primary-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <input type="radio" value={opt.value} {...register('payment_method')} className="sr-only" />
                        <span className={paymentMethod === opt.value ? 'text-primary-600' : 'text-gray-400'}>{opt.icon}</span>
                        <div>
                          <p className="font-semibold text-sm text-gray-800">{opt.label}</p>
                          <p className="text-xs text-gray-500">{opt.desc}</p>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'boleto' && (
                  <div>
                    <label className="label" htmlFor="cpf">CPF * (obrigatório para boleto)</label>
                    <input id="cpf" {...register('customer_cpf', { onChange: e => setValue('customer_cpf', maskCPF(e.target.value)) })}
                      className="input" placeholder="000.000.000-00" inputMode="numeric" />
                    {errors.customer_cpf && <p className="text-red-500 text-xs mt-1">{errors.customer_cpf.message}</p>}
                  </div>
                )}

                <button type="submit" disabled={submitting || quoteLoading || !itemsCount} className="btn-primary w-full justify-center text-base py-4 mt-2 disabled:opacity-60">
                  {submitting ? <><Loader2 size={20} className="animate-spin" /> Processando...</> : `Finalizar matrícula · ${brl(quote?.total || 0)}`}
                </button>

                <p className="text-center text-xs text-gray-500 mt-2 flex items-center justify-center gap-1">
                  <ShieldCheck size={14} className="text-green-600" /> Pagamento processado pelo Mercado Pago. Seus dados são protegidos.
                </p>
                <p className="text-center text-[11px] text-gray-400">
                  Ao finalizar você concorda com os <Link href="/termos-de-uso" className="underline" target="_blank">Termos de Uso</Link> e a <Link href="/politica-de-privacidade" className="underline" target="_blank">Política de Privacidade</Link>.
                </p>
              </form>
            </div>
          </div>

          {/* Resumo */}
          <div className="lg:col-span-2 order-1 lg:order-2">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 lg:sticky lg:top-4">
              <h2 className="font-bold text-primary-900 mb-4">Resumo do pedido {itemsCount > 1 && <span className="text-gray-400 font-normal">({itemsCount} cursos)</span>}</h2>

              {quoteLoading && !quote ? (
                <div className="py-8 flex justify-center"><Loader2 className="animate-spin text-primary-500" /></div>
              ) : (
                <ul className="space-y-3">
                  {quote?.items.map(i => (
                    <li key={i.course_id} className="flex gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-gray-800 text-sm leading-snug">{i.title}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{[i.modality, i.workload ? `${i.workload}h` : null, i.duration].filter(Boolean).join(' · ')}</p>
                      </div>
                      <div className="text-right shrink-0">
                        {i.discount > 0 && <p className="text-xs text-gray-400 line-through">{brl(i.unit_price)}</p>}
                        <p className="text-sm font-semibold">{brl(i.final_price)}</p>
                      </div>
                      {!single && itemsCount > 1 && (
                        <button type="button" onClick={() => cart.remove(i.course_id)} className="text-gray-300 hover:text-red-500 self-start" aria-label={`Remover ${i.title}`}><Trash2 size={14} /></button>
                      )}
                    </li>
                  ))}
                </ul>
              )}

              {!!quote?.unavailable.length && (
                <p className="mt-3 text-xs text-red-600 flex gap-1"><AlertCircle size={14} className="shrink-0" /> {quote.unavailable.length} curso(s) do carrinho não estão disponíveis para compra online e foram ignorados.</p>
              )}

              {/* Cupom */}
              <div className="mt-5">
                <label className="label" htmlFor="cupom">Cupom de desconto</label>
                <div className="flex gap-2">
                  <input id="cupom" value={couponInput} onChange={e => setCouponInput(e.target.value.toUpperCase())} className="input" placeholder="CÓDIGO" disabled={!!quote?.coupon} />
                  {quote?.coupon ? (
                    <button type="button" onClick={() => { setCoupon(''); setCouponInput('') }} className="px-4 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium">Remover</button>
                  ) : (
                    <button type="button" onClick={() => setCoupon(couponInput.trim())} disabled={!couponInput.trim() || quoteLoading}
                      className="px-4 py-2 bg-primary-600 text-white rounded-lg text-sm font-medium hover:bg-primary-700 disabled:opacity-50 flex items-center gap-1">
                      <Tag size={14} /> Aplicar
                    </button>
                  )}
                </div>
                {quote?.coupon && <p className="text-green-600 text-xs mt-1 flex items-center gap-1"><CheckCircle size={12} /> {quote.coupon.code}: {quote.coupon.discount_percent}% de desconto</p>}
                {coupon && quote?.couponError && <p className="text-red-500 text-xs mt-1">{quote.couponError}</p>}
              </div>

              <div className="mt-5 pt-5 border-t border-gray-100 space-y-2">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span>{brl(quote?.subtotal)}</span></div>
                {!!quote?.discount && (
                  <div className="flex justify-between text-sm text-green-600"><span>Desconto</span><span>- {brl(quote.discount)}</span></div>
                )}
                <div className="flex justify-between font-bold text-lg pt-2 border-t border-gray-100">
                  <span>Total</span>
                  <span className="text-primary-900">{quoteLoading ? <Loader2 size={18} className="animate-spin inline" /> : brl(quote?.total)}</span>
                </div>
                {paymentMethod === 'credit_card' && quote && quote.maxInstallments > 1 && (
                  <p className="text-xs text-gray-500 text-right">em até {quote.maxInstallments}x no cartão (parcelas calculadas pelo Mercado Pago)</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function CheckoutPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 size={40} className="animate-spin text-primary-600" /></div>}>
      <CheckoutInner />
    </Suspense>
  )
}
