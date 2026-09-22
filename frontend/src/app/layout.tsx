import type { Metadata, Viewport } from 'next'
import { Toaster } from 'react-hot-toast'
// v2: fonte Inter servida pelo próprio site (pacote npm, sem depender do Google Fonts no build
// nem no navegador). Antes: @import do Google Fonts no CSS, que bloqueava a renderização.
import '@fontsource-variable/inter'
import './globals.css'
import { CartProvider } from '@/lib/cart'
import { SITE_URL, SITE_NAME, DEFAULT_DESCRIPTION } from '@/lib/site'
import { getContent } from '@/lib/data'
import { organizationSchema, websiteSchema } from '@/lib/schema'
import JsonLd from '@/components/JsonLd'
import Analytics from '@/components/public/Analytics'

// v2: metadados padrão com metadataBase, canonical, Open Graph e Twitter.
// Cada página sobrescreve title/description/canonical/imagem.
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: 'Academy Pop – Cursos EAD Reconhecidos pelo MEC: EJA, Técnico, Graduação e Pós',
    template: '%s | Academy Pop',
  },
  description: DEFAULT_DESCRIPTION,
  applicationName: SITE_NAME,
  alternates: { canonical: '/' },
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_NAME,
    url: SITE_URL,
    title: 'Academy Pop – Cursos EAD Reconhecidos pelo MEC',
    description: DEFAULT_DESCRIPTION,
  },
  twitter: { card: 'summary_large_image' },
  robots: { index: true, follow: true },
  icons: { icon: '/favicon.svg' },
}

export const viewport: Viewport = {
  themeColor: '#1e3a8a',
  width: 'device-width',
  initialScale: 1,
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const content = await getContent()
  const footer = (content.footer || {}) as Record<string, string>
  const tracking = (content.tracking || {}) as Record<string, string>

  return (
    <html lang="pt-BR">
      <body>
        <CartProvider>
          {children}
        </CartProvider>
        <JsonLd data={[organizationSchema(footer), websiteSchema()]} />
        <Analytics gaId={tracking.ga4_id} pixelId={tracking.meta_pixel_id} />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 4000,
            style: { borderRadius: '10px', background: '#1e3a8a', color: '#fff' },
            success: { style: { background: '#15803d' } },
            error: { style: { background: '#dc2626' } },
          }}
        />
      </body>
    </html>
  )
}
