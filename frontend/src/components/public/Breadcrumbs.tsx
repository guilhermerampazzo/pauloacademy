import Link from 'next/link'
import JsonLd from '@/components/JsonLd'
import { breadcrumbSchema } from '@/lib/schema'

// Trilha de navegação visível + Schema BreadcrumbList
export default function Breadcrumbs({ items, dark = true }: { items: { name: string; path: string }[]; dark?: boolean }) {
  return (
    <>
      <nav aria-label="Você está em" className="mb-4">
        <ol className="flex flex-wrap items-center gap-2 text-sm">
          {items.map((it, i) => (
            <li key={it.path} className="flex items-center gap-2">
              {i > 0 && <span className={dark ? 'text-blue-500' : 'text-gray-300'}>/</span>}
              {i < items.length - 1 ? (
                <Link href={it.path} className={dark ? 'text-blue-300 hover:text-white' : 'text-gray-500 hover:text-gray-800'}>{it.name}</Link>
              ) : (
                <span className={dark ? 'text-blue-200' : 'text-gray-700'} aria-current="page">{it.name}</span>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbSchema(items)} />
    </>
  )
}
