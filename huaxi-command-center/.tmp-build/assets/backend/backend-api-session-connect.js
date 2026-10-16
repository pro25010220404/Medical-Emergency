/**
 * 登录后按 catalog 顺序探测全部 GET（低优先级队列，结果存 __HX_API_CONNECTED__）
 */
;(function () {
  const SKIP = new Set(['/auth/login'])

  function enabled() {
    try {
      if (localStorage.getItem('huaxi-api-connect-all') !== '1') return false
      if (localStorage.getItem('huaxi-api-mock') === '1') return false
    } catch {
      /* ignore */
    }
    return window.hxBackend?.strict?.()
  }

  async function connectAllGets() {
    if (!enabled() || !window.HX_API_CATALOG) return
    await window.hxBackend.ensureAuth()
    await window.hxEnsureApiSamples?.()
    const gets = window.HX_API_CATALOG.filter(
      (x) => x.method === 'GET' && !SKIP.has(x.path.split('?')[0]),
    )
    const out = []
    for (const item of gets) {
      const path = window.hxResolveApiPath
        ? window.hxResolveApiPath(item.path, {})
        : item.path.replace(/\{[^}]+\}/g, '1')
      if (window.hxApiProbeSkipPath?.(path)) {
        out.push({ path, ok: false, skipped: 'remote-gap' })
        continue
      }
      try {
        const data = await window.hxBackend.request('GET', path.startsWith('/') ? path : `/${path}`)
        out.push({ path, ok: true })
        window.__HX_API_CONNECTED__ = out
      } catch (e) {
        out.push({ path, ok: false, error: String(e.message || e) })
        window.__HX_API_CONNECTED__ = out
      }
      await new Promise((r) => setTimeout(r, 280))
    }
    const ok = out.filter((x) => x.ok).length
    console.info(`[hx-api-connect] GET ${ok}/${out.length} 已尝试`, out.filter((x) => !x.ok).slice(0, 8))
  }

  if (window.hxBackend?.enabled?.()) {
    window.hxBackend.ensureAuth(false).then((ok) => {
      if (ok) setTimeout(connectAllGets, 4000)
    })
  }
})()
