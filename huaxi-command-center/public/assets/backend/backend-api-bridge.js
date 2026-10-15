/**
 * 全站 Mock → Laravel /api/v1（JWT + 响应适配）
 * 默认严格模式：不走 public/api/*.json（?api=mock 或 localStorage huaxi-api-mock=1 可开 mock）
 */
;(function () {
  function apiBase() {
    const cfg = window.HX_API_CONFIG
    if (cfg?.base) return String(cfg.base).replace(/\/$/, '')
    return '/backend-api'
  }

  function apiV1() {
    return `${apiBase()}/v1`
  }

  const AUTH_URL = () => `${apiV1()}/auth/login`
  const TOKEN_KEY = 'huaxi-jwt-token'

  function mockAllowed() {
    try {
      if (new URLSearchParams(location.search).get('api') === 'mock') return true
      if (localStorage.getItem('huaxi-api-mock') === '1') return true
    } catch {
      /* ignore */
    }
    return false
  }

  function bridgeOff() {
    try {
      if (localStorage.getItem('huaxi-api-bridge') === '0') return true
    } catch {
      /* ignore */
    }
    return false
  }

  function pathOf(input) {
    try {
      if (typeof input === 'string') {
        const u = input.startsWith('http') ? new URL(input) : new URL(input, location.origin)
        return u.pathname
      }
      if (input instanceof Request) return new URL(input.url).pathname
    } catch {
      /* ignore */
    }
    return ''
  }

  function methodOf(input, init) {
    if (init?.method) return String(init.method).toUpperCase()
    if (input instanceof Request) return String(input.method).toUpperCase()
    return 'GET'
  }

  const nativeFetch = window.fetch.bind(window)
  let token = null
  let loginPromise = null
  /** 登录失败或 token 无效后冷却，避免 live-merge 并发把 login 打爆 */
  let authBlockedUntil = 0
  let tokenVerified = false
  const AUTH_COOLDOWN_MS = 90_000
  const ME_URL = () => `${apiV1()}/auth/me`
  const FRESH_TOKEN_KEY = 'huaxi-jwt-just-logged-in'

  function loadToken() {
    try {
      token = sessionStorage.getItem(TOKEN_KEY) || localStorage.getItem(TOKEN_KEY)
    } catch {
      token = null
    }
  }

  function clearToken() {
    token = null
    tokenVerified = false
    try {
      sessionStorage.removeItem(TOKEN_KEY)
      localStorage.removeItem(TOKEN_KEY)
    } catch {
      /* ignore */
    }
  }

  function saveToken(t) {
    token = t
    try {
      sessionStorage.setItem(TOKEN_KEY, t)
      localStorage.setItem(TOKEN_KEY, t)
    } catch {
      /* ignore */
    }
  }

  function unwrapEnvelope(body) {
    if (body && typeof body === 'object' && 'code' in body && 'data' in body && body.code === 200) {
      return body.data
    }
    return body
  }

  function authBlocked() {
    return Date.now() < authBlockedUntil
  }

  async function postLogin(cred) {
    if (bridgeOff()) throw new Error('后端桥接已关闭（localStorage huaxi-api-bridge=0）')
    const url = AUTH_URL()
    let res
    try {
      res = await nativeFetch(url, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cred.username, password: cred.password }),
      })
    } catch (e) {
      throw new Error(`无法连接 ${url}：${e.message || '网络错误或 CORS'}`)
    }
    let detail = ''
    try {
      const peek = await res.clone().json()
      detail = peek?.message || ''
    } catch {
      /* ignore */
    }
    if (!res.ok) {
      throw new Error(`login HTTP ${res.status}${detail ? `：${detail}` : ''}`)
    }
    const json = await res.json()
    const data = unwrapEnvelope(json)
    if (!data?.token) throw new Error('login 响应无 token')
    saveToken(data.token)
    tokenVerified = true
    authBlockedUntil = 0
    return true
  }

  let loginRedirectScheduled = false

  function isLoginEntryPage() {
    const p = location.pathname.replace(/\\/g, '/')
    return p === '/' || /index\.html$/i.test(p) || /login\.html$/i.test(p)
  }

  function redirectToLoginPage() {
    if (loginRedirectScheduled || isLoginEntryPage()) return
    try {
      if (localStorage.getItem('huaxi-demo-only') === '1') return
      if (localStorage.getItem('huaxi-api-mock') === '1') return
    } catch {
      /* ignore */
    }
    loginRedirectScheduled = true
    const next = location.pathname + location.search + location.hash
    location.replace('/index.html?next=' + encodeURIComponent(next || '/app.html'))
  }

  function isDemoOnly() {
    try {
      if (localStorage.getItem('huaxi-demo-only') === '1') return true
    } catch {
      /* ignore */
    }
    return false
  }

  function savedLoginCredentials() {
    let username = 'admin'
    let password = '123456'
    try {
      const u = localStorage.getItem('huaxi-api-user')?.trim()
      const p = localStorage.getItem('huaxi-api-pass')
      if (u) username = u
      if (p) password = p
    } catch {
      /* ignore */
    }
    return { username, password }
  }

  /** 仅校验已有 JWT（不在此函数内 POST login） */
  async function ensureAuth(force) {
    if (bridgeOff()) return false
    if (mockAllowed()) return false

    loadToken()
    if (!token) return false

    if (tokenVerified && !force) return true

    try {
      if (!force && sessionStorage.getItem(FRESH_TOKEN_KEY) === '1') {
        sessionStorage.removeItem(FRESH_TOKEN_KEY)
        tokenVerified = true
        return true
      }
    } catch {
      /* ignore */
    }

    let meStatus = 0
    let networkError = false
    try {
      const me = await nativeFetch(ME_URL(), {
        headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
      })
      meStatus = me.status
      if (me.ok) {
        tokenVerified = true
        authBlockedUntil = 0
        window.__HX_AUTH_LAST_ERROR__ = ''
        return true
      }
    } catch (e) {
      networkError = true
      window.__HX_AUTH_LAST_ERROR__ = String(e?.message || e || '网络错误')
    }

    /** 反代未配 / 502 等：保留 token，避免误清后只能进演示模式 */
    if (networkError || meStatus === 404 || meStatus === 502 || meStatus === 503 || meStatus === 504) {
      return false
    }

    if (meStatus === 401 || meStatus === 403) {
      clearToken()
      redirectToLoginPage()
      return false
    }

    clearToken()
    redirectToLoginPage()
    return false
  }

  /**
   * 列表页等：非演示模式下尽量拿到 JWT（已有 token 或静默 POST login）
   * @returns {Promise<{ ok: boolean, reason?: string }>}
   */
  async function ensureSession() {
    if (bridgeOff()) return { ok: false, reason: 'bridge-off' }
    if (mockAllowed()) return { ok: false, reason: 'mock' }
    if (isDemoOnly()) return { ok: false, reason: 'demo-only' }
    if (authBlocked()) return { ok: false, reason: 'auth-cooldown' }

    loadToken()
    if (token && (await ensureAuth(false))) return { ok: true }

    if (loginPromise) {
      try {
        await loginPromise
        return { ok: true }
      } catch (e) {
        return { ok: false, reason: 'login-failed', error: String(e?.message || e) }
      }
    }

    try {
      const cred = savedLoginCredentials()
      await postLogin(cred)
      return { ok: true }
    } catch (e) {
      authBlockedUntil = Date.now() + AUTH_COOLDOWN_MS
      window.__HX_AUTH_LAST_ERROR__ = String(e?.message || e)
      return { ok: false, reason: 'login-failed', error: window.__HX_AUTH_LAST_ERROR__ }
    }
  }

  async function login(username, password) {
    if (loginPromise) return loginPromise
    loginPromise = postLogin({
      username: String(username || '').trim(),
      password: String(password || ''),
    }).finally(() => {
      loginPromise = null
    })
    return loginPromise
  }

  function sleep(ms) {
    return new Promise((r) => setTimeout(r, ms))
  }

  const GET_CACHE_TTL_MS = 8000
  /** @type {Map<string, { at: number, data: unknown }>} */
  const getCache = new Map()
  /** @type {Map<string, Promise<unknown>>} */
  const getInflight = new Map()
  let queueTail = Promise.resolve()
  let lastRequestAt = 0
  const MIN_GAP_MS = 120

  function cacheKey(method, apiPath) {
    return `${method}:${apiPath}`
  }

  async function throttleGap() {
    const now = Date.now()
    const wait = Math.max(0, MIN_GAP_MS - (now - lastRequestAt))
    if (wait) await sleep(wait)
    lastRequestAt = Date.now()
  }

  async function backendRequest(apiPath, init) {
    const method = String(init?.method || 'GET').toUpperCase()
    const key = cacheKey(method, apiPath)

    if (method === 'GET' && !init?._skipCache) {
      const hit = getCache.get(key)
      if (hit && Date.now() - hit.at < GET_CACHE_TTL_MS) return hit.data
      const inflight = getInflight.get(key)
      if (inflight) return inflight
    }

    const run = async () => {
      const authed = await ensureAuth(false)
      if (!authed) throw new Error(`未登录，已跳过 ${apiPath}`)
      await throttleGap()
      const headers = {
        Accept: 'application/json',
        ...(init?.headers || {}),
      }
      if (token) headers.Authorization = `Bearer ${token}`
      let res = await nativeFetch(`${apiV1()}${apiPath}`, { ...init, headers })
      if (res.status === 401) {
        clearToken()
        redirectToLoginPage()
        throw new Error(`未授权 ${apiPath}`)
      }
      let attempt = 0
      while (res.status === 429 && attempt < 3) {
        attempt += 1
        const wait = Number(res.headers.get('Retry-After') || attempt) * 1000
        await sleep(Math.min(8000, Math.max(800, wait)))
        res = await nativeFetch(`${apiV1()}${apiPath}`, {
          ...init,
          headers: { ...headers, Authorization: token ? `Bearer ${token}` : headers.Authorization },
        })
      }
      if (!res.ok) throw new Error(`HTTP ${res.status} ${apiPath}`)
      const ct = res.headers.get('content-type') || ''
      const body = ct.includes('application/json') ? await res.json() : await res.text()
      if (method === 'GET' && !init?._skipCache) {
        getCache.set(key, { at: Date.now(), data: body })
      }
      return body
    }

    const task =
      method === 'GET' && !init?._skipCache
        ? (() => {
            const p = queueTail.then(run)
            queueTail = p.catch(() => {})
            getInflight.set(key, p)
            return p.finally(() => {
              getInflight.delete(key)
            })
          })()
        : queueTail.then(run).then((v) => {
            queueTail = Promise.resolve()
            return v
          })

    return task
  }

  async function backendGet(apiPath) {
    return backendRequest(apiPath, { method: 'GET' })
  }

  async function backendJson(method, apiPath, body) {
    const init = {
      method,
      headers: { 'Content-Type': 'application/json' },
    }
    if (body !== undefined) init.body = JSON.stringify(body)
    const json = await backendRequest(apiPath, init)
    return unwrapEnvelope(json)
  }

  const GPS_STATUS_ZH = {
    STANDBY: '待命',
    DISPATCHING: '出警中',
    ON_SCENE: '现场处置',
    RETURNING: '返院途中',
  }

  function adaptSlaPayload(body) {
    const raw = unwrapEnvelope(body)
    if (!raw || typeof raw !== 'object') return raw
    const rec = raw.records
    if (rec && !Array.isArray(rec) && Array.isArray(rec.data)) {
      return { ...raw, records: rec.data }
    }
    return raw
  }

  function adaptVehiclesGps(body) {
    const data = unwrapEnvelope(body)
    if (!data?.vehicles) return data
    return {
      ...data,
      vehicles: data.vehicles.map((v) => ({
        ...v,
        status: GPS_STATUS_ZH[v.status] || v.status,
      })),
    }
  }

  async function loadStaticGisCollab() {
    const r = await nativeFetch('/api/gis-collab.json', { cache: 'no-store' })
    if (!r.ok) throw new Error('static gis-collab missing')
    return r.json()
  }

  async function adaptGisCollab() {
    let staticPack = null
    try {
      staticPack = await loadStaticGisCollab()
    } catch {
      /* optional */
    }
    try {
      const raw = await backendGet('/dashboard/county-map')
      const data = unwrapEnvelope(raw)
      const livePack = {
        erToday: data?.erToday ?? 0,
        nodes: data?.nodes ?? [],
        links: data?.links ?? [],
      }
      return {
        updatedAt: data?.updatedAt || new Date().toISOString(),
        weiyuan: livePack.nodes?.length ? livePack : staticPack?.weiyuan || livePack,
        dafang: staticPack?.dafang || livePack,
      }
    } catch (e) {
      console.warn('[hx-api-bridge] county-map 失败，回退 gis-collab.json', e)
      if (staticPack) return staticPack
      throw e
    }
  }

  async function adaptGrassrootsRemote() {
    const raw = await backendGet('/critical/vitals?pageNum=1&pageSize=30')
    const data = unwrapEnvelope(raw)
    const list = data?.list || []
    return {
      title: '基层远程监护',
      notice: '数据来源：GET /api/v1/critical/vitals',
      sites: list.map((item) => ({
        name: item.bedLabel || item.bedId || '监护点',
        patient: item.patientName || item.patientId || '—',
        vitals: `HR ${item.heartRate ?? '—'} · SpO₂ ${item.spo2 ?? '—'}%`,
        videoHref: '/#/critical',
        bedHref: item.bedId ? `/#/bed/${item.bedId}` : '/#/critical',
      })),
    }
  }

  async function loadStaticSubHospitalMonitor() {
    const r = await nativeFetch('/api/sub-hospital-monitor.json', { cache: 'no-store' })
    if (!r.ok) throw new Error('static sub-hospital-monitor')
    return r.json()
  }

  async function adaptSubHospitalMonitor() {
    const orgRaw = await backendGet('/organizations?per_page=50')
    const orgPayload = unwrapEnvelope(orgRaw)
    const orgs = asList(orgPayload)
    const hospitals = []
    for (const org of orgs.slice(0, 12)) {
      const code = String(org.org_code || org.id || '').trim()
      if (!code) continue
      let depts = []
      try {
        const bedRaw = await backendGet(`/beds/by-dept?hospitalId=${encodeURIComponent(code)}`)
        const bed = unwrapEnvelope(bedRaw)
        depts = (bed?.departments || []).map((d) => ({
          name: d.name || d.dept_name || '—',
          bedsUsed: d.occupied ?? d.bedsUsed ?? 0,
          bedsTotal: d.total ?? d.bedsTotal ?? 0,
          alerts: 0,
          status:
            (d.free ?? 0) <= 1
              ? '紧张'
              : (d.occupied ?? 0) / (d.total || 1) > 0.85
                ? '关注'
                : '正常',
        }))
      } catch {
        depts = []
      }
      if (!depts.length) continue
      hospitals.push({
        id: code,
        name: org.org_name || org.name || code,
        tier: org.org_type || org.tier || '机构',
        departments: depts,
      })
    }
    if (hospitals.length) {
      return {
        title: '下级医院科室监控',
        notice: '',
        hospitals,
      }
    }
    const staticPack = await loadStaticSubHospitalMonitor()
    return { ...staticPack, notice: '' }
  }

  /** @type {Record<string, string | (() => Promise<unknown>)>} */
  const MOCK_ROUTES = {
    '/api/qc-standards.json': () => backendGet('/qc-standards/summary').then(unwrapEnvelope),
    '/api/qc-sla.json': () => backendGet('/sla-records').then(adaptSlaPayload),
    '/api/dispatch-live.json': () => backendGet('/dispatch-live').then(unwrapEnvelope),
    '/api/dispatch-ambulances.json': () => backendGet('/ambulances').then(unwrapEnvelope),
    '/api/vehicles-gps.json': () => backendGet('/vehicles/gps').then(adaptVehiclesGps),
    '/api/warning-demo.json': () => backendGet('/warnings/summary').then(unwrapEnvelope),
    '/api/consultation-admission.json': () => backendGet('/consultations/admission').then(unwrapEnvelope),
    '/api/beds-by-dept.json': () => backendGet('/beds/by-dept').then(unwrapEnvelope),
    '/api/care-bindings.json': () => backendGet('/care-bindings').then(unwrapEnvelope),
    '/api/device-bindings.json': () => backendGet('/devices').then(unwrapEnvelope),
    '/api/gis-collab.json': adaptGisCollab,
    '/api/grassroots-remote-monitor.json': adaptGrassrootsRemote,
    '/api/sub-hospital-monitor.json': adaptSubHospitalMonitor,
    '/api/grassroots-demo.json': async () => {
      const transfers = await window.hxBackend.list('/transfers', { per_page: 5 })
      const consult = await unwrapEnvelope(await backendGet('/consultations?pageNum=1&pageSize=5'))
      const list = consult?.list || consult?.data || []
      return {
        title: '基层调度链（后端）',
        notice: 'transfers + consultations',
        steps: [
          { id: 'consult', label: '会诊', detail: list[0]?.sessionId || '队列', href: '/#/consultations' },
          { id: 'transfer', label: '转诊', detail: transfers[0]?.transfer_code || '转诊单', href: '/#/transfers' },
        ],
        transferDemo: transfers[0]
          ? { patientName: transfers[0].patient?.real_name || '患者', badge: '后端转诊' }
          : null,
      }
    },
  }

  let scenarioCache = null
  let scenarioCacheAt = 0
  let scenarioInflight = null
  const SCENARIO_CACHE_MS = 90_000

  function invalidateScenarioCache() {
    scenarioCache = null
    scenarioCacheAt = 0
  }

  window.invalidateScenarioCache = invalidateScenarioCache
  window.addEventListener('hashchange', invalidateScenarioCache)

  async function hydrateScenarioInner() {
    const useFull =
      window.hxFullBackend?.() && window.hxBackend?.strict?.() && window.hxBuildScenarioFromBackend
    if (useFull) {
      try {
        await ensureAuth(false)
        return await window.hxBuildScenarioFromBackend()
      } catch (e) {
        console.error('[hx-api-bridge] 全后端 scenario 失败，回退 scenario.json', e)
        const r = await nativeFetch('/scenario.json', { cache: 'no-store' })
        if (r.ok) return r.json()
        if (mockAllowed()) return {}
        throw e
      }
    }
    const base = await nativeFetch('/scenario.json', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : { state: {} }))
      .catch(() => ({ schemaVersion: 2, state: {} }))
    if (window.hxLiveMergeEnabled?.() && window.hxMergeScenarioFromApis) {
      try {
        return await window.hxMergeScenarioFromApis(base)
      } catch (e) {
        console.warn('[hx-api-bridge] scenario live merge', e)
        return base
      }
    }
    if (!window.hxFullBackend?.() || !window.hxBackend?.strict?.()) return base
    if (window.hxBuildScenarioFromBackend) {
      try {
        await ensureAuth(false)
        const fromApi = await window.hxBuildScenarioFromBackend()
        base.state = { ...base.state, ...fromApi.state }
        base.mobile = fromApi.mobile || base.mobile
        base.vehicles = fromApi.vehicles?.length ? fromApi.vehicles : base.vehicles
        base.measurements = fromApi.measurements?.length ? fromApi.measurements : base.measurements
        base.notice = fromApi.notice
      } catch (e) {
        console.warn('[hx-api-bridge] scenario partial sync', e)
      }
    }
    return base
  }

  async function hydrateScenario() {
    const now = Date.now()
    if (scenarioCache && now - scenarioCacheAt < SCENARIO_CACHE_MS) {
      return scenarioCache
    }
    if (scenarioInflight) return scenarioInflight
    scenarioInflight = hydrateScenarioInner()
      .then((data) => {
        scenarioCache = data
        scenarioCacheAt = Date.now()
        return data
      })
      .finally(() => {
        scenarioInflight = null
      })
    return scenarioInflight
  }

  MOCK_ROUTES['/scenario.json'] = hydrateScenario

  function jsonResponse(body, status) {
    return new Response(JSON.stringify(body), {
      status: status || 200,
      statusText: status === 503 ? 'Service Unavailable' : 'OK',
      headers: { 'Content-Type': 'application/json' },
    })
  }

  window.fetch = function hxFetch(input, init) {
    const path = pathOf(input)
    const method = methodOf(input, init)
    const handler = MOCK_ROUTES[path]

    if (!bridgeOff() && method === 'GET' && (path === '/scenario.json' || handler)) {
      const fn = path === '/scenario.json' ? hydrateScenario : handler
      return Promise.resolve()
        .then(() => (typeof fn === 'function' ? fn() : backendGet(fn).then(unwrapEnvelope)))
        .then((body) => jsonResponse(body))
        .catch(async (err) => {
          console.warn('[hx-api-bridge] 后端请求失败:', path, err)
          if (path === '/scenario.json' || mockAllowed()) {
            const r = await nativeFetch(path === '/scenario.json' ? '/scenario.json' : input, init)
            if (r.ok) return r
          }
          if (path === '/api/gis-collab.json') {
            try {
              return jsonResponse(await loadStaticGisCollab())
            } catch {
              /* fall through */
            }
          }
          return jsonResponse(
            { error: 'backend_unavailable', path, message: String(err.message || err) },
            503,
          )
        })
    }

    if (!bridgeOff() && path.startsWith('/api/v1/')) {
      const apiPath = path.slice('/api/v1'.length) || '/'
      const qs = typeof input === 'string' && input.includes('?') ? input.slice(input.indexOf('?')) : ''
      return backendRequest(`${apiPath}${qs}`, { method, ...(init || {}), body: init?.body })
        .then((body) => {
          if (typeof body === 'string') return new Response(body, { status: 200 })
          return jsonResponse(body)
        })
        .catch((err) => {
          if (mockAllowed()) return nativeFetch(input, init)
          return jsonResponse({ error: String(err.message || err) }, 503)
        })
    }

    return nativeFetch(input, init)
  }

  function getJson(path, query) {
    const [base, embeddedQs] = path.split('?')
    const params = new URLSearchParams(embeddedQs || '')
    if (query) {
      Object.entries(query).forEach(([k, v]) => {
        if (v !== undefined && v !== null) params.set(k, String(v))
      })
    }
    const qs = params.toString()
    return backendGet(`${base}${qs ? `?${qs}` : ''}`).then(unwrapEnvelope)
  }

  function asList(payload) {
    if (Array.isArray(payload)) return payload
    if (payload && Array.isArray(payload.data)) return payload.data
    if (payload && Array.isArray(payload.list)) return payload.list
    return []
  }

  window.hxBackend = {
    enabled: () => !bridgeOff(),
    strict: () => !bridgeOff() && !mockAllowed(),
    authBlocked,
    clearAuth: () => {
      authBlockedUntil = 0
      clearToken()
    },
    login,
    loginUrl: AUTH_URL,
    saveTokenFromLogin(t) {
      saveToken(t)
      tokenVerified = true
      authBlockedUntil = 0
      try {
        sessionStorage.setItem(FRESH_TOKEN_KEY, '1')
      } catch {
        /* ignore */
      }
    },
    /** 登录页专用：必定 POST /auth/login（nativeFetch，Network 里名为 login） */
    loginWithPassword(username, password) {
      return postLogin({
        username: String(username || '').trim(),
        password: String(password || ''),
      })
    },
    async logout() {
      loadToken()
      try {
        if (token && !bridgeOff()) {
          await nativeFetch(`${apiV1()}/auth/logout`, {
            method: 'POST',
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
          })
        }
      } catch (e) {
        console.warn('[hx-api-bridge] logout API', e)
      }
      clearToken()
      try {
        localStorage.removeItem('huaxi-demo-only')
      } catch {
        /* ignore */
      }
      loginRedirectScheduled = true
      location.replace('/index.html')
    },
    goLoginPage() {
      return window.hxBackend.logout()
    },
    base: apiV1(),
    apiRoot: apiBase,
    ensureAuth,
    ensureSession,
    isDemoOnly,
    unwrap: unwrapEnvelope,
    get: getJson,
    post(path, body) {
      return backendJson('POST', path.startsWith('/') ? path : `/${path}`, body)
    },
    put(path, body) {
      return backendJson('PUT', path.startsWith('/') ? path : `/${path}`, body)
    },
    patch(path, body) {
      return backendJson('PATCH', path.startsWith('/') ? path : `/${path}`, body)
    },
    delete(path) {
      return backendRequest(path.startsWith('/') ? path : `/${path}`, { method: 'DELETE' }).then(unwrapEnvelope)
    },
    request(method, path, body) {
      const m = method.toUpperCase()
      if (m === 'GET') return getJson(path)
      if (m === 'DELETE') return window.hxBackend.delete(path)
      return backendJson(m, path.startsWith('/') ? path : `/${path}`, body)
    },
    list(path, query) {
      const q = { ...(query || {}) }
      if (q.pageSize == null && q.per_page != null) q.pageSize = q.per_page
      if (q.pageSize == null) q.pageSize = 50
      if (q.pageNum == null && q.page != null) q.pageNum = q.page
      return getJson(path, q).then(asList)
    },
    health() {
      const tryUrls = [`${apiV1()}/health`, `${apiBase()}/health`, `${apiBase()}/v1/health`]
      return (async () => {
        for (const url of tryUrls) {
          try {
            const r = await nativeFetch(url, { headers: { Accept: 'application/json' } })
            if (r.ok) return r.json()
          } catch {
            /* next */
          }
        }
        return null
      })()
    },
  }

})()
