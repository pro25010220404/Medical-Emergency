/**
 * 远程实测未部署或易 404 的路径（全量探测跳过；进对应业务页仍走 route 绑定）
 */
;(function () {
  const PREFIX_GAPS = [
    '/coordination/',
    '/mobile-reception/',
    '/reception/',
    '/settings/',
    '/rooms/',
    '/monitoring/streams/',
  ]

  const REGEX_GAPS = [
    /^\/organizations\/[^/]+\//,
    /^\/ambulances\/[^/?]+$/,
    /^\/transfers\/[^/?]+(\/|$)/,
    /^\/vehicles\/[^/?]+(\/|$)/,
    /^\/beds\/[^/?]+(\/|$)/,
  ]

  const BEDS_LIST = new Set([
    '/beds/overview',
    '/beds/distribution',
    '/beds/by-dept',
    '/beds/reserved',
  ])

  window.HX_REMOTE_ROUTE_GAPS = PREFIX_GAPS

  window.hxApiPathRemoteGap = function hxApiPathRemoteGap(path) {
    const p = String(path || '').split('?')[0]
    if (!p.startsWith('/')) return false
    if (BEDS_LIST.has(p) || p.startsWith('/beds/by-dept')) return false
    if (PREFIX_GAPS.some((prefix) => p.startsWith(prefix))) return true
    return REGEX_GAPS.some((re) => re.test(p))
  }

  window.hxApiProbeSkipPath = function hxApiProbeSkipPath(path, opts) {
    opts = opts || {}
    if (window.hxApiPathRemoteGap(path) && !opts.includeRemoteGaps) return true
    return false
  }
})()
