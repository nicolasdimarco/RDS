import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import { useAuth } from '@/store/auth'

const baseURL = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000/api/v1'

export const api = axios.create({ baseURL, headers: { 'Content-Type': 'application/json' } })

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = useAuth.getState().access
  if (token) config.headers.set('Authorization', `Bearer ${token}`)
  return config
})

let refreshing: Promise<string | null> | null = null

async function refreshAccess(): Promise<string | null> {
  const refresh = useAuth.getState().refresh
  if (!refresh) return null
  try {
    const { data } = await axios.post(`${baseURL}/auth/refresh/`, { refresh })
    useAuth.getState().setTokens(data.access, data.refresh ?? refresh)
    return data.access as string
  } catch {
    useAuth.getState().logout()
    return null
  }
}

api.interceptors.response.use(
  (r) => r,
  async (error: AxiosError) => {
    const original = error.config as InternalAxiosRequestConfig & { _retry?: boolean }
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true
      refreshing = refreshing ?? refreshAccess().finally(() => { refreshing = null })
      const newToken = await refreshing
      if (newToken) {
        original.headers.set('Authorization', `Bearer ${newToken}`)
        return api.request(original)
      }
    }
    return Promise.reject(error)
  },
)

export type Page<T> = { count: number; next: string | null; previous: string | null; results: T[] }

export function unwrap<T>(data: Page<T> | T[] | T): T[] {
  if (Array.isArray(data)) return data
  if (data && typeof data === 'object' && 'results' in (data as object)) {
    return (data as Page<T>).results
  }
  return [data as T]
}

export function extractApiError(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data
    if (typeof data === 'string') return data
    if (data && typeof data === 'object') {
      const detail = (data as Record<string, unknown>).detail
      if (typeof detail === 'string') return detail
      const parts: string[] = []
      const walk = (obj: unknown, prefix = ''): void => {
        if (Array.isArray(obj)) obj.forEach((v) => walk(v, prefix))
        else if (obj && typeof obj === 'object') {
          for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
            walk(v, prefix ? `${prefix}.${k}` : k)
          }
        } else if (obj != null) parts.push(prefix ? `${prefix}: ${obj}` : String(obj))
      }
      walk(data)
      if (parts.length) return parts.join(' · ')
    }
    return err.message
  }
  return err instanceof Error ? err.message : 'Error desconocido'
}
