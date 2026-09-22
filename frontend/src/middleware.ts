import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { jwtVerify } from 'jose'

const PUBLIC_ADMIN = ['/admin/login', '/admin/esqueci-senha', '/admin/redefinir-senha']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // v2.1: páginas públicas do admin (login, esqueci a senha, redefinir senha)
  if (PUBLIC_ADMIN.includes(pathname)) return NextResponse.next()

  if (pathname.startsWith('/admin')) {
    const token = request.headers.get('x-admin-token') || request.cookies.get('admin_token')?.value

    if (!token) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }

    try {
      const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'fallback')
      await jwtVerify(token, secret)
      return NextResponse.next()
    } catch {
      const res = NextResponse.redirect(new URL('/admin/login', request.url))
      res.cookies.delete('admin_token')
      return res
    }
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/admin/:path*'],
}
