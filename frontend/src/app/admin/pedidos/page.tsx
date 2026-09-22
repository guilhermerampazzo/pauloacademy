'use client'
import { useEffect, useState } from 'react'
import { Loader2, CheckCircle, Clock, AlertCircle, Search, RefreshCw } from 'lucide-react'
import toast from 'react-hot-toast'
import api from '@/lib/api'
import type { Order } from '@/types'

const STATUS = {
  paid: { label: 'Pago', cls: 'bg-green-100 text-green-700', icon: <CheckCircle size={12} /> },
  pending: { label: 'Pendente', cls: 'bg-yellow-100 text-yellow-700', icon: <Clock size={12} /> },
  failed: { label: 'Falhou', cls: 'bg-red-100 text-red-700', icon: <AlertCircle size={12} /> },
  refunded: { label: 'Reembolsado', cls: 'bg-gray-100 text-gray-600', icon: <RefreshCw size={12} /> },
}

export default function PedidosPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const load = () => { api.get('/orders').then(r => setOrders(r.data)).finally(() => setLoading(false)) }
  useEffect(load, [])

  const updateStatus = async (id: number, status: string) => {
    try {
      await api.put(`/orders/${id}/status`, { status })
      setOrders(os => os.map(o => o.id === id ? { ...o, status: status as Order['status'] } : o))
      toast.success('Status atualizado')
    } catch { toast.error('Erro ao atualizar') }
  }

  const filtered = orders.filter(o => {
    const matchSearch = !search ||
      o.customer_name.toLowerCase().includes(search.toLowerCase()) ||
      o.customer_email.toLowerCase().includes(search.toLowerCase()) ||
      o.course_title?.toLowerCase().includes(search.toLowerCase()) ||
      String(o.id) === search.replace('#', '')
    const matchStatus = !statusFilter || o.status === statusFilter
    return matchSearch && matchStatus
  })

  const total = filtered.reduce((s, o) => s + Number(o.amount), 0)
  const paid = filtered.filter(o => o.status === 'paid').reduce((s, o) => s + Number(o.amount), 0)

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pedidos</h1>
          <p className="text-gray-500">{orders.length} pedidos no total</p>
        </div>
        <button onClick={() => { setLoading(true); load() }} className="p-2 text-gray-400 hover:text-primary-600 bg-white rounded-lg border border-gray-200">
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Resumo */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Receita Total</p>
          <p className="text-2xl font-bold text-green-600">{paid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Volume Total</p>
          <p className="text-2xl font-bold text-gray-700">{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
          <p className="text-sm text-gray-500">Taxa de Conversão</p>
          <p className="text-2xl font-bold text-blue-600">
            {orders.length > 0 ? `${Math.round((orders.filter(o => o.status === 'paid').length / orders.length) * 100)}%` : '0%'}
          </p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 flex gap-3">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="input pl-9" placeholder="Buscar por cliente ou curso..." />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="input w-40">
            <option value="">Todos</option>
            <option value="paid">Pago</option>
            <option value="pending">Pendente</option>
            <option value="failed">Falhou</option>
          </select>
        </div>

        {loading ? (
          <div className="flex items-center justify-center p-16"><Loader2 size={32} className="animate-spin text-primary-500" /></div>
        ) : filtered.length === 0 ? (
          <div className="text-center p-16 text-gray-400">Nenhum pedido encontrado.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['#', 'Cliente', 'Curso', 'Valor', 'Pagamento', 'Status', 'Data', 'Ação'].map(h => (
                    <th key={h} className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(order => {
                  const s = STATUS[order.status] || STATUS.pending
                  return (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-4 py-4 text-gray-400 text-xs">#{order.id}</td>
                      <td className="px-4 py-4">
                        <p className="font-medium text-gray-900">{order.customer_name}</p>
                        <p className="text-gray-400 text-xs">{order.customer_email}</p>
                        {order.customer_phone && <p className="text-gray-400 text-xs">{order.customer_phone}</p>}
                      </td>
                      <td className="px-4 py-4 text-gray-600 text-xs max-w-[240px]">
                        {order.items && order.items.length > 0 ? (
                          <ul className="space-y-0.5">
                            {order.items.map((it, i) => (
                              <li key={i} className="truncate" title={it.course_title}>
                                {order.items!.length > 1 && '• '}{it.course_title}
                                {Number(it.discount) > 0 && <span className="text-green-600"> (−{Number(it.discount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})</span>}
                              </li>
                            ))}
                          </ul>
                        ) : order.course_title}
                        {order.coupon_code && <p className="text-[11px] text-primary-600 mt-1">Cupom {order.coupon_code}</p>}
                      </td>
                      <td className="px-4 py-4 font-semibold text-gray-900">
                        {Number(order.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">
                        <span className="capitalize">{order.payment_method === 'credit_card' ? 'cartão' : order.payment_method}</span>
                        {order.payment_status_detail && <p className="text-[11px] text-gray-400">MP: {order.payment_status_detail}</p>}
                        {order.payment_error && <p className="text-[11px] text-red-500 max-w-[160px]" title={order.payment_error}>Erro MP: {order.payment_error.slice(0, 60)}</p>}
                      </td>
                      <td className="px-4 py-4">
                        <span className={`inline-flex items-center gap-1 ${s.cls} badge`}>{s.icon} {s.label}</span>
                      </td>
                      <td className="px-4 py-4 text-gray-500 text-xs">
                        {new Date(order.created_at).toLocaleDateString('pt-BR')}<br />
                        {new Date(order.created_at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-4 py-4">
                        <select
                          value={order.status}
                          onChange={e => updateStatus(order.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="pending">Pendente</option>
                          <option value="paid">Marcar pago</option>
                          <option value="failed">Falhou</option>
                          <option value="refunded">Reembolsado</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
