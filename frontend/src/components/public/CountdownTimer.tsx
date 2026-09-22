'use client'
import { useEffect, useState } from 'react'
import { Timer } from 'lucide-react'

// Antes: quando a data expirava, o contador se renovava sozinho (urgência falsa,
// risco perante o CDC art. 37). Agora: mostra o tempo até a data real da oferta
// e some quando ela termina.
export default function CountdownTimer({ expiresAt }: { expiresAt: string }) {
  const [left, setLeft] = useState<number | null>(null)

  useEffect(() => {
    const target = new Date(expiresAt).getTime()
    const update = () => setLeft(target - Date.now())
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [expiresAt])

  if (left === null || left <= 0 || Number.isNaN(left)) return null

  const d = Math.floor(left / 86_400_000)
  const h = Math.floor((left % 86_400_000) / 3_600_000)
  const m = Math.floor((left % 3_600_000) / 60_000)
  const s = Math.floor((left % 60_000) / 1_000)
  const pad = (n: number) => String(n).padStart(2, '0')
  const date = new Date(expiresAt).toLocaleDateString('pt-BR')

  return (
    <div>
      <p className="flex items-center gap-2 text-accent-200 text-sm font-semibold mb-2">
        <Timer size={16} /> Condição válida até {date}
      </p>
      <div className="flex gap-2">
        {[{ v: d, l: 'dias' }, { v: h, l: 'horas' }, { v: m, l: 'min' }, { v: s, l: 'seg' }].map(x => (
          <div key={x.l} className="bg-white/10 rounded-lg px-3 py-2 text-center min-w-[56px]">
            <div className="text-2xl font-black tabular-nums">{pad(x.v)}</div>
            <div className="text-[10px] uppercase tracking-wide text-blue-200">{x.l}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
