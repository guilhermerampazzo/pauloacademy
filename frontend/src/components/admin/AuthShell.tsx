import { GraduationCap } from 'lucide-react'

// Moldura das telas de acesso (login, esqueci a senha, redefinir senha)
export default function AuthShell({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-950 to-primary-800 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-accent-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <GraduationCap size={32} className="text-white" />
          </div>
          <p className="text-3xl font-black text-white">Academy<span className="text-accent-400">Pop</span></p>
          <p className="text-blue-300 mt-1">Painel Administrativo</p>
        </div>
        <div className="bg-white rounded-2xl shadow-2xl p-8">
          <h1 className="text-xl font-bold text-primary-900 mb-1">{title}</h1>
          {subtitle && <p className="text-sm text-gray-500 mb-6">{subtitle}</p>}
          {!subtitle && <div className="mb-5" />}
          {children}
        </div>
      </div>
    </div>
  )
}
