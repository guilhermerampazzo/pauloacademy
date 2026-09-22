'use client'

export function getToken(): string | null {
  if (typeof window === 'undefined') return null
  return localStorage.getItem('admin_token')
}

export function setToken(token: string) {
  localStorage.setItem('admin_token', token)
}

export function removeToken() {
  localStorage.removeItem('admin_token')
}

export function isAuthenticated(): boolean {
  return !!getToken()
}

// v2.1: grava a sessão (localStorage para a API + cookie para o middleware do Next)
export function saveSession(token: string) {
  setToken(token)
  const secure = typeof window !== 'undefined' && window.location.protocol === 'https:' ? '; secure' : ''
  document.cookie = `admin_token=${token}; path=/; max-age=${7 * 24 * 3600}; samesite=strict${secure}`
}
