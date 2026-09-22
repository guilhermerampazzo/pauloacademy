'use client'
import { useEffect } from 'react'
import { pushRecent } from './SearchBox'

// Guarda o curso em "vistos recentemente" (sugestões da busca)
export default function RecordRecent({ slug, title }: { slug: string; title: string }) {
  useEffect(() => { pushRecent({ slug, title }) }, [slug, title])
  return null
}
