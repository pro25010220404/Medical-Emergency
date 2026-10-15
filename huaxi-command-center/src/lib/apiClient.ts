/**
 * Laravel /api/v1 客户端（与 public/assets/backend-api-bridge 行为一致，供 React 源码使用）
 */

const TOKEN_KEY = 'huaxi-jwt-token'

export type ApiEnvelope<T = unknown> = {
  code?: number
  message?: string
  data?: T
}

declare global {
  interface Window {
    HX_API_CONFIG?: { base?: string }
  }
}

function normalizeApiRoot(raw: string): string {
  return raw.replace(/\/$/, '').replace(/\/v1$/, '')
}

/** 与 backend-api-config.js / inject 脚本一致：build env → localStorage → HX_API_CONFIG → 同源代理 */
export function apiRoot(): string {
  const env = import.meta.env.VITE_API_BASE as string | undefined
  if (env?.trim()) return normalizeApiRoot(env.trim())
  try {
    const ls = localStorage.getItem('huaxi-api-origin')
    if (ls?.trim()) return normalizeApiRoot(ls.trim())
  } catch {
    /* ignore */
  }
  if (typeof window !== 'undefined' && window.HX_API_CONFIG?.base) {
    return normalizeApiRoot(String(window.HX_API_CONFIG.base))
  }
  return '/backend-api'
}

function v1Base(): string {
  return `${apiRoot()}/v1`
}

function loadCredentials(username?: string, password?: string) {
  let u = username
  let p = password
  if (u == null || u === '') {
    u = (import.meta.env.VITE_API_USER as string | undefined)?.trim()
  }
  if (p == null || p === '') {
    p = (import.meta.env.VITE_API_PASS as string | undefined)?.trim()
  }
  try {
    if (!u) u = localStorage.getItem('huaxi-api-user') ?? undefined
    if (!p) p = localStorage.getItem('huaxi-api-pass') ?? undefined
  } catch {
    /* ignore */
  }
  return {
    username: u || 'admin',
    password: p || '123456',
  }
}

export function clearAuthTokens() {
  try {
    sessionStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(TOKEN_KEY)
  } catch {
    /* ignore */
  }
}

function loadToken(): string | null {
  try {
    return sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
  } catch {
    return null
  }
}

function saveToken(token: string) {
  try {
    sessionStorage.setItem(TOKEN_KEY, token)
    localStorage.setItem(TOKEN_KEY, token)
  } catch {
    /* ignore */
  }
}

export function unwrap<T>(body: unknown): T {
  if (body && typeof body === 'object' && 'code' in body) {
    const env = body as ApiEnvelope<T>
    if (env.code === 200 && 'data' in env) return env.data as T
    if (env.code != null && env.code !== 200) {
      throw new Error(env.message || `API 错误 code=${env.code}`)
    }
  }
  return body as T
}

export function asList(payload: unknown): unknown[] {
  if (Array.isArray(payload)) return payload
  if (payload && typeof payload === 'object') {
    const p = payload as Record<string, unknown>
    if (Array.isArray(p.data)) return p.data
    if (Array.isArray(p.list)) return p.list
  }
  return []
}

let loginPromise: Promise<string> | null = null
let loginCooldownUntil = 0

const GET_CACHE_TTL_MS = import.meta.env.DEV ? 4_000 : 12_000
const getCache = new Map<string, { at: number; data: unknown }>()
const getInflight = new Map<string, Promise<unknown>>()

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export async function login(username?: string, password?: string): Promise<string> {
  if (Date.now() < loginCooldownUntil) {
    throw new Error('登录失败次数过多，请稍后在登录页重试')
  }
  const creds = loadCredentials(username, password)
  if (loginPromise) return loginPromise
  loginPromise = (async () => {
    const res = await fetch(`${v1Base()}/auth/login`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: creds.username,
        password: creds.password,
        device: 'web',
      }),
    })
    const json = await res.json().catch(() => ({}))
    if (!res.ok) {
      const msg =
        json && typeof json === 'object' && 'message' in json
          ? String((json as ApiEnvelope).message)
          : `HTTP ${res.status}`
      throw new Error(`登录失败：${msg}`)
    }
    const data = unwrap<{ token: string }>(json)
    if (!data?.token) throw new Error('登录响应无 token')
    saveToken(data.token)
    try {
      if (username?.trim()) localStorage.setItem('huaxi-api-user', username.trim())
      if (password != null && password !== '') localStorage.setItem('huaxi-api-pass', password)
    } catch {
      /* ignore */
    }
    loginCooldownUntil = 0
    return data.token
  })().catch((e) => {
    loginCooldownUntil = Date.now() + 15_000
    clearAuthTokens()
    throw e
  }).finally(() => {
    loginPromise = null
  })
  return loginPromise
}

async function authHeaders(): Promise<HeadersInit> {
  let token = loadToken()
  if (!token) token = await login()
  return {
    Accept: 'application/json',
    Authorization: `Bearer ${token}`,
  }
}

type AuthFetchInit = RequestInit & { _retried?: boolean }

async function fetchWithAuth(url: string, init: AuthFetchInit, p: string): Promise<Response> {
  const { _retried, ...fetchInit } = init
  let res = await fetch(url, fetchInit)
  if (res.status === 401 && !_retried) {
    clearAuthTokens()
    getCache.clear()
    getInflight.clear()
    await login()
    const headers = await authHeaders()
    res = await fetch(url, { ...fetchInit, headers })
    if (res.status === 401) {
      clearAuthTokens()
      throw new Error(`未授权 ${p}（请重新登录）`)
    }
  } else if (res.status === 401) {
    clearAuthTokens()
    throw new Error(`未授权 ${p}（请重新登录）`)
  }
  if (res.status === 429 && !_retried) {
    const retryAfter = Number(res.headers.get('Retry-After') || '2')
    await sleep(Math.min(8, Math.max(1, retryAfter)) * 1000)
    const headers = await authHeaders()
    res = await fetch(url, { ...fetchInit, headers })
  }
  if (!res.ok) {
    const msg = await res.text().catch(() => '')
    throw new Error(`${init.method ?? 'GET'} ${p} → HTTP ${res.status}${msg ? ` ${msg.slice(0, 80)}` : ''}`)
  }
  return res
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const p = path.startsWith('/') ? path : `/${path}`
  const url = `${v1Base()}${p}`

  if (method === 'GET') {
    const now = Date.now()
    const hit = getCache.get(url)
    if (hit && now - hit.at < GET_CACHE_TTL_MS) return hit.data as T
    const pending = getInflight.get(url)
    if (pending) return (await pending) as T
    const job = (async () => {
      const headers = await authHeaders()
      const res = await fetchWithAuth(url, { method: 'GET', headers }, p)
      const json = await res.json()
      const data = unwrap<T>(json)
      getCache.set(url, { at: Date.now(), data })
      return data
    })().finally(() => {
      getInflight.delete(url)
    })
    getInflight.set(url, job)
    return job
  }

  const headers = await authHeaders()
  const init: AuthFetchInit = { method, headers }
  if (body !== undefined) {
    ;(headers as Record<string, string>)['Content-Type'] = 'application/json'
    init.body = JSON.stringify(body)
  }
  const res = await fetchWithAuth(url, init, p)
  const json = await res.json()
  getCache.clear()
  return unwrap<T>(json)
}

export function apiGet<T = unknown>(path: string) {
  return request<T>('GET', path)
}

export function apiPost<T = unknown>(path: string, body?: unknown) {
  return request<T>('POST', path, body)
}

export function apiPut<T = unknown>(path: string, body?: unknown) {
  return request<T>('PUT', path, body)
}

export function apiDelete<T = unknown>(path: string) {
  return request<T>('DELETE', path)
}

export async function apiList(path: string, query?: Record<string, string | number>) {
  const params = new URLSearchParams()
  if (query) {
    Object.entries(query).forEach(([k, v]) => params.set(k, String(v)))
  }
  const qs = params.toString()
  const full = qs ? `${path}${path.includes('?') ? '&' : '?'}${qs}` : path
  return asList(await apiGet(full))
}

export async function healthCheck() {
  const res = await fetch(`${apiRoot()}/health`)
  if (!res.ok) throw new Error('health failed')
  return res.json()
}
