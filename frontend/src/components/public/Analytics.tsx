'use client'
import Script from 'next/script'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

// GA4 e Meta Pixel. IDs vêm do CMS (Conteúdo > Rastreamento).
// Não carrega nada no painel /admin.
export default function Analytics({ gaId, pixelId }: { gaId?: string; pixelId?: string }) {
  const pathname = usePathname()
  const isAdmin = pathname?.startsWith('/admin')

  // Page view do Pixel em navegação client-side
  useEffect(() => {
    if (isAdmin) return
    const w = window as unknown as { fbq?: (...a: unknown[]) => void }
    w.fbq?.('track', 'PageView')
  }, [pathname, isAdmin])

  if (isAdmin) return null
  const ga = gaId && /^G-[A-Z0-9]+$/i.test(gaId) ? gaId : null
  const px = pixelId && /^\d{5,20}$/.test(pixelId) ? pixelId : null

  return (
    <>
      {ga && (
        <>
          <Script src={`https://www.googletagmanager.com/gtag/js?id=${ga}`} strategy="afterInteractive" />
          <Script id="ga4" strategy="afterInteractive">{`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', '${ga}');
          `}</Script>
        </>
      )}
      {px && (
        <Script id="meta-pixel" strategy="afterInteractive">{`
          !function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
          n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
          n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
          t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,
          document,'script','https://connect.facebook.net/en_US/fbevents.js');
          fbq('init', '${px}');
        `}</Script>
      )}
    </>
  )
}
