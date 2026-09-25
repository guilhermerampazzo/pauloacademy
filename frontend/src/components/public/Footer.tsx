import Link from 'next/link'
import { GraduationCap, Phone, Mail, Instagram, Facebook, Youtube, MapPin } from 'lucide-react'
import { getCategoryInfo, categoryHref } from '@/lib/categories'

interface FooterData {
  company_name?: string
  description?: string
  whatsapp?: string
  email?: string
  address?: string
  instagram?: string
  facebook?: string
  youtube?: string
  cnpj?: string
}

// v2: links de cursos apontam para as páginas de categoria (antes: todos iam para /#cursos
// e incluíam "Compliance"), links institucionais novos e políticas reais (antes href="#").
export default function Footer({ data, categories = [] }: { data?: FooterData; categories?: { category: string; count: number }[] }) {
  const d = data || {}
  const cats = categories.map(c => getCategoryInfo(c.category)).sort((a, b) => a.order - b.order)

  return (
    <footer className="bg-primary-950 text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <Link href="/" className="flex items-center gap-2 font-bold text-xl mb-4">
              <div className="w-9 h-9 bg-accent-500 rounded-lg flex items-center justify-center">
                <GraduationCap size={22} className="text-white" />
              </div>
              <span>{d.company_name || 'Academy Pop'}</span>
            </Link>
            <p className="text-blue-300 text-sm leading-relaxed">
              {d.description || 'Educação de qualidade para transformar vidas.'}
            </p>
            <div className="flex gap-3 mt-4">
              {d.instagram && (
                <a href={d.instagram} target="_blank" rel="noopener noreferrer" aria-label="Instagram"
                   className="w-9 h-9 bg-primary-800 hover:bg-accent-600 rounded-lg flex items-center justify-center transition-colors">
                  <Instagram size={16} />
                </a>
              )}
              {d.facebook && (
                <a href={d.facebook} target="_blank" rel="noopener noreferrer" aria-label="Facebook"
                   className="w-9 h-9 bg-primary-800 hover:bg-accent-600 rounded-lg flex items-center justify-center transition-colors">
                  <Facebook size={16} />
                </a>
              )}
              {d.youtube && (
                <a href={d.youtube} target="_blank" rel="noopener noreferrer" aria-label="YouTube"
                   className="w-9 h-9 bg-primary-800 hover:bg-accent-600 rounded-lg flex items-center justify-center transition-colors">
                  <Youtube size={16} />
                </a>
              )}
            </div>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Cursos</h3>
            <ul className="space-y-2 text-blue-300 text-sm">
              {cats.map(c => (
                <li key={c.slug}><Link href={categoryHref(c.name)} className="hover:text-white transition-colors">{c.label}</Link></li>
              ))}
              <li><Link href="/cursos" className="hover:text-white transition-colors">Todos os cursos</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Institucional</h3>
            <ul className="space-y-2 text-blue-300 text-sm">
              <li><Link href="/sobre-nos" className="hover:text-white transition-colors">Sobre nós</Link></li>
              <li><Link href="/como-funciona" className="hover:text-white transition-colors">Como funciona</Link></li>
              <li><Link href="/reconhecimento-mec" className="hover:text-white transition-colors">Reconhecimento MEC</Link></li>
              <li><Link href="/parceiros" className="hover:text-white transition-colors">Parceiros</Link></li>
              <li><Link href="/blog" className="hover:text-white transition-colors">Blog</Link></li>
              <li><Link href="/perguntas-frequentes" className="hover:text-white transition-colors">Perguntas frequentes</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-white mb-4">Contato</h3>
            <ul className="space-y-3 text-blue-300 text-sm">
              {d.whatsapp && (
                <li>
                  <a href={`https://wa.me/${String(d.whatsapp).replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer"
                     className="flex items-center gap-2 hover:text-white transition-colors">
                    <Phone size={14} /> WhatsApp
                  </a>
                </li>
              )}
              {d.email && (
                <li>
                  <a href={`mailto:${d.email}`} className="flex items-center gap-2 hover:text-white transition-colors break-all">
                    <Mail size={14} className="shrink-0" /> {d.email}
                  </a>
                </li>
              )}
              {d.address && <li className="flex gap-2 text-blue-400"><MapPin size={14} className="shrink-0 mt-0.5" /> {d.address}</li>}
            </ul>
          </div>
        </div>

        <div className="border-t border-primary-800 mt-10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-blue-400 text-xs text-center md:text-left">
            © {new Date().getFullYear()} {d.company_name || 'Academy Pop'}. Todos os direitos reservados.
            {d.cnpj ? ` CNPJ ${d.cnpj}` : ''}
          </p>
          <div className="flex gap-4 text-blue-400 text-xs">
            <Link href="/politica-de-privacidade" className="hover:text-white">Política de Privacidade</Link>
            <Link href="/termos-de-uso" className="hover:text-white">Termos de Uso</Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
