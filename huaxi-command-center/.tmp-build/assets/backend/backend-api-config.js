/**
 * 后端 API 根地址（含 /api 前缀）
 * - 开发：Vite 代理 /backend-api → 下方 origin，避免 CORS
 * - 静态部署：直连 origin + /api
 * 覆盖：localStorage huaxi-api-origin = http://host:port/api
 *       或 URL ?apiOrigin=http://host:port/api
 */
;(function () {
  const DEFAULT_ORIGIN = 'http://62.234.128.72:7824'
  const API_PREFIX = '/api'

  function normalizeBase(url) {
    return String(url || '')
      .replace(/\/$/, '')
      .replace(/\/v1$/, '')
  }

  function isCrossOriginApiUrl(url) {
    try {
      const u = new URL(String(url), location.origin)
      return u.origin !== location.origin
    } catch {
      return true
    }
  }

  let base = `${DEFAULT_ORIGIN}${API_PREFIX}`
  let apiOriginFromQuery = false

  try {
    const q = new URLSearchParams(location.search).get('apiOrigin')
    if (q) {
      base = normalizeBase(q)
      apiOriginFromQuery = true
    } else {
      const ls = localStorage.getItem('huaxi-api-origin')
      if (ls) {
        const norm = normalizeBase(ls)
        const port = location.port
        const viteDev = port === '5173' || port === '4173'
        /** 生产站点勿用 localStorage 里残留的跨域 IP，否则 CORS 导致「有登录 UI 但 API 全失败」 */
        if (viteDev || !isCrossOriginApiUrl(norm)) base = norm
      }
    }
  } catch {
    /* ignore */
  }

  const port = location.port
  const viteDev = port === '5173' || port === '4173'
  const hasApiOriginOverride = (() => {
    try {
      if (apiOriginFromQuery) return true
      const ls = localStorage.getItem('huaxi-api-origin')
      if (ls) {
        const norm = normalizeBase(ls)
        if (viteDev || !isCrossOriginApiUrl(norm)) return true
      }
    } catch {
      /* ignore */
    }
    return false
  })()
  /** 开发走 Vite 代理；生产静态默认同源 /backend-api（Nginx 反代 Laravel），避免跨域 CORS */
  const useProxy = !hasApiOriginOverride && (viteDev || !/^localhost$|^127\.0\.0\.1$/i.test(location.hostname))

  /** 默认混合模式：scenario.json + 能通的 API；仅 huaxi-full-backend=1 时纯后端 */
  let fullBackend = false
  try {
    if (localStorage.getItem('huaxi-full-backend') === '1') fullBackend = true
    if (new URLSearchParams(location.search).get('api') === 'mock') fullBackend = false
    if (localStorage.getItem('huaxi-api-mock') === '1') fullBackend = false
    if (localStorage.getItem('huaxi-full-backend') === '0') fullBackend = false
  } catch {
    /* ignore */
  }

  window.HX_API_CONFIG = {
    origin: DEFAULT_ORIGIN,
    apiPrefix: API_PREFIX,
    /** 实际请求前缀：开发走同源代理，其余直连部署地址 */
    base: useProxy ? '/backend-api' : base,
    deployOrigin: DEFAULT_ORIGIN,
    /** 为 true 时 scenario / 质控台账等不再以本地演示为主 */
    fullBackend,
  }
})()
