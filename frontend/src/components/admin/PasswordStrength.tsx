// Indicador simples de força da senha (orientativo; a regra obrigatória é mínimo de 10 caracteres)
export default function PasswordStrength({ value }: { value: string }) {
  if (!value) return <p className="text-xs text-gray-400 mt-1">Mínimo de 10 caracteres. Uma frase longa é mais segura e fácil de lembrar.</p>
  let score = 0
  if (value.length >= 10) score++
  if (value.length >= 14) score++
  if (/[a-z]/.test(value) && /[A-Z]/.test(value)) score++
  if (/\d/.test(value)) score++
  if (/[^A-Za-z0-9]/.test(value)) score++
  const level = value.length < 10 ? 0 : score <= 2 ? 1 : score <= 3 ? 2 : 3
  const labels = ['Muito curta', 'Fraca', 'Boa', 'Forte']
  const colors = ['bg-red-500', 'bg-orange-400', 'bg-yellow-400', 'bg-green-500']
  return (
    <div className="mt-2">
      <div className="flex gap-1">{[0, 1, 2, 3].map(i => <div key={i} className={`h-1.5 flex-1 rounded ${i <= level ? colors[level] : 'bg-gray-200'}`} />)}</div>
      <p className="text-xs text-gray-500 mt-1">{labels[level]}{value.length < 10 ? ` (${value.length}/10)` : ''}</p>
    </div>
  )
}
