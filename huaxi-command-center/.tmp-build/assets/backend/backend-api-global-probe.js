/**
 * 登录后探测 HX_API_CATALOG 中全部 GET 接口（占位符替换为 1 / demo）
 */
;(function () {
  const SKIP = new Set(['/auth/login'])

  function probeEnabled() {
    try {
      if (localStorage.getItem('huaxi-api-probe') === '1') return true
      if (new URLSearchParams(location.search).get('apiProbe') === '1') return true
    } catch {
      /* ignore */
    }
    return false
  }

  async function probeAll() {
    if (!probeEnabled() || !window.hxBackend?.strict?.() || !window.HX_API_CATALOG) return
    await window.hxBackend.ensureAuth()
    await window.hxEnsureApiSamples?.()
    const gets = window.HX_API_CATALOG.filter((x) => x.method === 'GET' && !SKIP.has(x.path.split('?')[0]))
    const out = []
    const includeGaps = localStorage.getItem('huaxi-api-probe-strict') === '1'
    for (const item of gets) {
      const path = window.hxResolveApiPath
        ? window.hxResolveApiPath(item.path, {})
        : item.path.replace(/\{[^}]+\}/g, '1')
      if (window.hxApiProbeSkipPath?.(path, { includeRemoteGaps: includeGaps })) {
        out.push({ path, ok: false, skipped: 'remote-gap' })
        continue
      }
      try {
        await window.hxBackend.request('GET', path.startsWith('/') ? path : `/${path}`)
        out.push({ path, ok: true })
      } catch (e) {
        out.push({ path, ok: false, error: String(e.message || e) })
      }
      await new Promise((r) => setTimeout(r, 350))
    }
    window.__HX_API_PROBE__ = out
    const bad = out.filter((x) => !x.ok).length
    console.info(`[hx-api-probe] GET ${out.length - bad}/${out.length} OK`, out.filter((x) => !x.ok))
  }

  if (window.hxBackend?.enabled?.()) {
    window.hxBackend.ensureAuth(false).then((ok) => {
      if (ok) setTimeout(probeAll, 2500)
    })
  }
})()
