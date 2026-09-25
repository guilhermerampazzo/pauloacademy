// Geradores de dados estruturados Schema.org
import type { Course } from '@/types'
import { SITE_URL, SITE_NAME, absoluteUrl, stripHtml } from './site'
import { categoryHref } from './categories'

type Footer = { company_name?: string; email?: string; whatsapp?: string; address?: string; instagram?: string; facebook?: string; youtube?: string; description?: string }

export function organizationSchema(footer: Footer = {}) {
  const sameAs = [footer.instagram, footer.facebook, footer.youtube].filter(Boolean)
  return {
    '@context': 'https://schema.org',
    '@type': 'EducationalOrganization',
    '@id': `${SITE_URL}/#organization`,
    name: footer.company_name || SITE_NAME,
    url: SITE_URL,
    logo: absoluteUrl('/favicon.svg'),
    description: footer.description || undefined,
    email: footer.email || undefined,
    telephone: footer.whatsapp ? `+${String(footer.whatsapp).replace(/\D/g, '')}` : undefined,
    address: footer.address ? { '@type': 'PostalAddress', streetAddress: footer.address, addressCountry: 'BR' } : undefined,
    sameAs: sameAs.length ? sameAs : undefined,
  }
}

export function websiteSchema() {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: 'pt-BR',
    publisher: { '@id': `${SITE_URL}/#organization` },
    // Caixa de busca do site no Google (sitelinks searchbox)
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE_URL}/cursos?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  }
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  const list = faqs.filter(f => f.question && f.answer)
  if (!list.length) return null
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: list.map(f => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: stripHtml(f.answer, 5000) },
    })),
  }
}

export function courseSchema(course: Course) {
  const price = Number(course.price_pix || 0)
  const url = absoluteUrl(`/cursos/${course.slug}`)
  return {
    '@context': 'https://schema.org',
    '@type': 'Course',
    '@id': `${url}#course`,
    name: course.title,
    description: course.seo_description || course.subtitle || stripHtml(course.description, 300) || course.title,
    url,
    image: course.cover_image ? absoluteUrl(course.cover_image) : undefined,
    inLanguage: 'pt-BR',
    educationalLevel: course.category,
    provider: { '@type': 'EducationalOrganization', '@id': `${SITE_URL}/#organization`, name: SITE_NAME, sameAs: SITE_URL },
    offers: price > 0 ? [{
      '@type': 'Offer',
      category: 'Paid',
      price: price.toFixed(2),
      priceCurrency: 'BRL',
      availability: 'https://schema.org/InStock',
      url,
    }] : undefined,
    hasCourseInstance: [{
      '@type': 'CourseInstance',
      courseMode: 'Online',
      courseWorkload: course.workload ? `PT${course.workload}H` : undefined,
    }],
  }
}

export function itemListSchema(courses: Course[], name: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name,
    itemListElement: courses.slice(0, 100).map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: absoluteUrl(`/cursos/${c.slug}`),
      name: c.title,
    })),
  }
}

export function articleSchema(post: { title: string; slug: string; excerpt?: string; cover_image?: string; published_at?: string; updated_at?: string; author?: string }) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: post.title,
    description: post.excerpt || undefined,
    image: post.cover_image ? absoluteUrl(post.cover_image) : undefined,
    datePublished: post.published_at || undefined,
    dateModified: post.updated_at || post.published_at || undefined,
    author: { '@type': post.author ? 'Person' : 'Organization', name: post.author || SITE_NAME },
    publisher: { '@id': `${SITE_URL}/#organization` },
    mainEntityOfPage: absoluteUrl(`/blog/${post.slug}`),
  }
}

export { categoryHref }

// v2.4: página de parceiro (instituição de ensino ou empresa)
export function partnerSchema(p: { type: string; name: string; slug: string; summary?: string | null; logo?: string | null; website?: string | null; city?: string | null; state?: string | null }) {
  return {
    '@context': 'https://schema.org',
    '@type': p.type === 'ies' ? 'CollegeOrUniversity' : 'Organization',
    name: p.name,
    url: p.website || absoluteUrl(`/parceiros/${p.slug}`),
    description: p.summary || undefined,
    logo: p.logo ? absoluteUrl(p.logo) : undefined,
    address: p.city ? { '@type': 'PostalAddress', addressLocality: p.city, addressRegion: p.state || undefined, addressCountry: 'BR' } : undefined,
    memberOf: { '@id': `${SITE_URL}/#organization` },
  }
}
