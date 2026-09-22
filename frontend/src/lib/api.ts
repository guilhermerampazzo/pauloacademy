import axios from 'axios'

function getBaseUrl() {
  if (typeof window === 'undefined') {
    return process.env.INTERNAL_API_URL || 'http://backend:3001'
  }
  return '/api'
}

const api = axios.create({
  baseURL: getBaseUrl(),
  timeout: 15000,
})

api.interceptors.request.use((config) => {
  if (typeof window !== 'undefined') {
    const token = localStorage.getItem('admin_token')
    if (token) config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err.response?.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('admin_token')
      document.cookie = 'admin_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT'
      if (window.location.pathname.startsWith('/admin') && !['/admin/login', '/admin/esqueci-senha', '/admin/redefinir-senha'].includes(window.location.pathname)) {
        window.location.href = '/admin/login'
      }
    }
    return Promise.reject(err)
  }
)

export default api
