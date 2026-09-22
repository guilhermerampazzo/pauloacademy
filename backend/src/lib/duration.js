// Normaliza o campo "duração" dos cursos.
// No banco havia 10 grafias para 4 valores ("3-a-6-meses ", "6-A-12-meses",
// "6-a12-meses", "de-3-a-6-meses"...). Esta função devolve sempre o formato
// "3 a 6 meses", "6 a 12 meses", "8 semestres", "18 meses".
function normalizeDuration(value) {
  if (value === null || value === undefined) return value
  let s = String(value).trim()
  if (!s) return ''
  s = s
    .toLowerCase()
    .replace(/[-_]+/g, ' ')         // hífens viram espaço
    .replace(/\s+/g, ' ')
    .replace(/^de\s+/, '')          // "de 3 a 6 meses" -> "3 a 6 meses"
    .replace(/(\d)\s*a\s*(\d)/g, '$1 a $2') // "6 a12" -> "6 a 12"
    .replace(/(\d)\s*(meses|mes|mês|semestres|semestre|anos|ano|semanas|semana)\b/g, '$1 $2')
    .trim()
  // "1 mes" / "1 mês"
  s = s.replace(/\bmes\b/g, 'mês')
  return s
}

module.exports = { normalizeDuration }
