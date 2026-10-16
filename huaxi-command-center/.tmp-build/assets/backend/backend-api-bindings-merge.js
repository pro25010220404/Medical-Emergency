/**
 * 将 HX_API_CATALOG 中各 tag 的 GET 合并进 HX_ROUTE_BINDINGS（去重，带 {param} 的走 useSamples）
 */
;(function () {
  /** 首页大屏仅用 catalog 里手写的 13 条绑定；勿合并整 tag（否则 40+ 顺序探测 → 429/401 + 布局卡顿） */
  const ROUTE_TAGS = {
    '/': [],
    '/dispatch': ['dispatch', 'vehicle'],
    '/register': ['dispatch', 'org', 'patient'],
    '/warning': ['warning'],
    '/critical': ['critical'],
    '/monitoring': ['monitor'],
    '/patients': ['patient'],
    '/patient/:id': ['patient'],
    '/beds': ['bed'],
    '/bed/:id': ['bed'],
    '/consultations': ['consult'],
    '/room/:token': ['consult'],
    '/join/:token': ['consult'],
    '/transfers': ['transfer'],
    '/transport/:id': ['transfer'],
    '/organizations': ['org'],
    '/centers': ['center'],
    '/center/:id': ['center'],
    '/messages': ['message'],
    '/coordination': ['coord'],
    '/medical-quality': ['qc'],
    '/medical-quality/reports': ['qc'],
    '/medical-quality/rectify/:id': ['qc'],
    '/quality': ['qc'],
    '/dr': ['dr'],
    '/devices': ['device'],
    '/settings': ['settings'],
    '/episode/:id': ['dispatch'],
    '/mobile-reception/:token': ['mobile'],
  }

  const SKIP_GET = new Set(['/auth/login'])

  function catalogGetsForTag(tag) {
    return (window.HX_API_CATALOG || [])
      .filter((item) => item.method === 'GET' && item.tag === tag && !SKIP_GET.has(item.path.split('?')[0]))
      .map((item) => ({
        method: 'GET',
        path: item.path,
        useSamples: /\{[^}]+\}/.test(item.path),
      }))
  }

  function mergeBindings() {
    if (!window.HX_ROUTE_BINDINGS || !window.HX_API_CATALOG) return
    const base = { ...window.HX_ROUTE_BINDINGS }
    for (const [route, tags] of Object.entries(ROUTE_TAGS)) {
      const seen = new Set()
      const list = []
      for (const manual of base[route] || []) {
        const k = manual.path
        if (seen.has(k)) continue
        seen.add(k)
        list.push(manual)
      }
      for (const tag of tags) {
        for (const b of catalogGetsForTag(tag)) {
          if (seen.has(b.path)) continue
          seen.add(b.path)
          list.push(b)
        }
      }
      base[route] = list
    }
    window.HX_ROUTE_BINDINGS = base
  }

  mergeBindings()
  window.hxRefreshRouteBindings = mergeBindings
})()
