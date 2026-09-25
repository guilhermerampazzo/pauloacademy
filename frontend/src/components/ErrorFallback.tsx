'use client'
// v2.4: tela de erro com recarga automática depois de uma atualização do site.
// Quando sai uma versão nova, uma aba aberta antes do deploy tenta baixar arquivos
// que não existem mais (ChunkLoadError). Antes isso virava "carregando" sem fim.
// Agora a página recarrega sozinha uma vez; nos outros erros mostra "Tentar de novo".
import { useEffect } from 'react'

const KEY = 'ap_chunk_reload_at'

function isChunkError(error: Error) {
  const text = `${error?.name || ''} ${error?.message || ''}`
  return /ChunkLoadError|Loading chunk [\w-]+ failed|Loading CSS chunk|Failed to fetch dynamically imported module|importing a module script failed/i.test(text)
}

export default function ErrorFallback({ error, reset, area }: { error: Error & { digest?: string }; reset: () => void; area: 'site' | 'admin' }) {
  const chunk = isChunkError(error)

  useEffect(() => {
    if (!chunk) { console.error(error); return }
    let last = 0
    try { last = Number(sessionStorage.getItem(KEY) || 0) } catch { /* sem sessionStorage */ }
    // evita laço: no máximo uma recarga automática a cada 30 s
    if (Date.now() - last > 30_000) {
      try { sessionStorage.setItem(KEY, String(Date.now())) } catch { /* ignora */ }
      window.location.reload()
    }
  }, [chunk, error])

  return (
    <div className={`${area === 'admin' ? 'p-12' : 'min-h-[60vh] p-8'} flex items-center justify-center`}>
      <div className="max-w-md text-center">
        <p className="text-lg font-bold text-primary-900 mb-2">
          {chunk ? 'O site foi atualizado' : 'Algo deu errado ao abrir esta página'}
        </p>
        <p className="text-sm text-gray-600 mb-5">
          {chunk ? 'Estamos recarregando a página com a versão nova.' : 'Tente de novo. Se continuar, recarregue a página.'}
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => reset()} className="btn-primary justify-center">Tentar de novo</button>
          <button onClick={() => window.location.reload()} className="btn-secondary justify-center">Recarregar a página</button>
        </div>
      </div>
    </div>
  )
}
