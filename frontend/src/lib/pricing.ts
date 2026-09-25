// v2.4: regras de exibição de preço.
// "Sem juros" só é verdade quando o total parcelado não passa do preço à vista.
type PriceLike = {
  price_pix?: number | string | null
  installments?: number | string | null
  installment_value?: number | string | null
  price_installment?: number | string | null
}

export function installmentHasInterest(c: PriceLike): boolean {
  const pix = Number(c.price_pix || 0)
  const n = Number(c.installments || 0)
  const v = Number(c.installment_value || 0)
  const total = Math.max(n > 0 && v > 0 ? n * v : 0, Number(c.price_installment || 0))
  return pix > 0 && total > pix + 0.1
}

/**
 * Remove "sem juros" dos textos quando o parcelamento tem acréscimo.
 * Vale para descrição, seções extras, FAQ, subtítulo e meta description,
 * que são escritos no painel e podiam anunciar "12x sem juros" com total maior que o PIX.
 */
export function honestText<T extends string | null | undefined>(text: T, course: PriceLike): T {
  if (!text || !installmentHasInterest(course)) return text
  return String(text)
    .replace(/\s*\(\s*sem juros\s*\)/gi, '')
    .replace(/,?\s*sem juros(?=[\s.,;:!?<)]|$)/gi, '') as T
}

// v2.4: tabela "Boleto/PIX parcelado" (TMB). Mesma conta do backend (lib/tmb.js > simulate):
// entrada (percentual ou valor fixo, até 50% do preço) + parcelas pela tabela Price.
export interface TmbCfg {
  max_parcelas?: number | null
  juros_mes?: number | null
  entrada_tipo?: 'percentual' | 'valor' | null
  entrada_valor?: number | null
  parcela_minima?: number | null
}
export interface TmbSimulacao { entrada: number; juros_mes: number; opcoes: { parcelas: number; valor: number }[] }
const r2 = (n: number) => Math.round(n * 100) / 100

export function tmbSimulate(cfg: TmbCfg, price: number): TmbSimulacao {
  const juros = cfg.juros_mes ?? 3.49
  const ev = cfg.entrada_valor ?? 10
  const entrada = ev ? r2(Math.min(Math.max(cfg.entrada_tipo === 'valor' ? ev : price * ev / 100, 0), price / 2)) : 0
  const financiado = r2(price - entrada)
  const i = juros / 100
  const max = cfg.max_parcelas || 36
  // v2.4: todos os planos do link, da parcela mínima (padrão 3) até o máximo
  const min = Math.min(cfg.parcela_minima && cfg.parcela_minima > 0 ? cfg.parcela_minima : 3, max)
  const lista: number[] = []
  for (let n = min; n <= max; n++) lista.push(n)
  return {
    entrada,
    juros_mes: juros,
    opcoes: lista.map(n => ({ parcelas: n, valor: r2(i > 0 ? financiado * i / (1 - Math.pow(1 + i, -n)) : financiado / n) })),
  }
}

export const pct = (n: number) => `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
export const nx = (n: number) => `${String(n).padStart(2, '0')}x`
