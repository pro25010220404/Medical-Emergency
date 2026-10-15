/**
 * 仅保护 app.html：无 JWT 则回登录页 index.html（不在此脚本内登录）
 */
;(function () {
  const path = location.pathname.replace(/\\/g, '/')
  const isApp = /\/app\.html$/i.test(path)
  if (!isApp) return

  function clearLegacyDemoFlags() {
    try {
      localStorage.removeItem('huaxi-demo-only')
      localStorage.removeItem('huaxi-api-mock')
    } catch {
      /* ignore */
    }
  }

  function hasToken() {
    try {
      return !!(sessionStorage.getItem('huaxi-jwt-token') || localStorage.getItem('huaxi-jwt-token'))
    } catch {
      return false
    }
  }

  if (!hasToken()) {
    clearLegacyDemoFlags()
    const next = '/app.html' + location.search + location.hash
    location.replace('/index.html?next=' + encodeURIComponent(next))
    return
  }

  clearLegacyDemoFlags()
})()
