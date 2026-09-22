'use client'
import { useEffect } from 'react'
import { track } from '@/lib/analytics'

// Dispara um evento de analytics quando a página abre (ex.: view_item na página do curso)
export default function TrackView({ event, params }: { event: string; params?: Record<string, unknown> }) {
  useEffect(() => {
    const t = setTimeout(() => track(event, params), 800) // espera os scripts carregarem
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event])
  return null
}
