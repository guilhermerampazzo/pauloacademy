import { brl } from '@/lib/site'
import { pct, nx, type TmbSimulacao } from '@/lib/pricing'

// v2.4: bloco "Boleto ou PIX parcelado" (TMB) – entrada + todos os planos do link (a partir de 3x) + juros e aprovação.
// Usado no cartão de preço do curso e no checkout.
export default function TmbTable({ sim, compact = false }: { sim: TmbSimulacao; compact?: boolean }) {
  if (!sim.opcoes.length) return null
  return (
    <div className={compact ? '' : 'rounded-xl border border-gray-200 bg-gray-50 p-4'}>
      {!compact && <p className="text-sm font-bold text-primary-900 mb-2">Boleto ou PIX parcelado <span className="font-normal text-gray-500">(sem cartão)</span></p>}
      {sim.entrada > 0 && (
        <p className="text-sm text-gray-700">Entrada de <strong className="text-primary-900">{brl(sim.entrada)}</strong> + {sim.opcoes.length > 1 ? `de ${sim.opcoes[0].parcelas} a ${sim.opcoes[sim.opcoes.length - 1].parcelas} parcelas` : 'parcelas'}:</p>
      )}
      <ul className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mt-2" aria-label="Planos de parcelamento">
        {sim.opcoes.map(o => (
          <li key={o.parcelas} className="rounded-md bg-white border border-gray-200 px-1.5 py-1 text-center leading-tight">
            <span className="block text-[11px] text-gray-500">{nx(o.parcelas)}</span>
            <span className="block text-[13px] font-bold text-primary-900 whitespace-nowrap">{brl(o.valor)}</span>
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-gray-500 mt-2 leading-snug">
        Taxa de juros do financiamento: de 1 a {sim.opcoes[sim.opcoes.length - 1].parcelas} parcelas, {pct(sim.juros_mes)} a.m. Sujeito a aprovação de cadastro pela TMB. Valores estimados: o valor final aparece no checkout da TMB antes de você confirmar.
      </p>
    </div>
  )
}
