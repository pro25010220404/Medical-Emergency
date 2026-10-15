/**
 * 仅保护 app.html：无 JWT 则回登录页 index.html（不在此脚本内登录）
 */
;(function () {
  const path = location.pathname.replace(/\\/g, '/')
  const isApp = /\/app\.html$/i.test(path)
  if (!isApp) return

  function demoOnly() {
    try {
      if (localStorage.getItem('huaxi-demo-only') === '1') return true
      if (localStorage.getItem('huaxi-api-mock') === '1') return true
      if (new URLSearchParams(location.search).get('api') === 'mock') return true
      if (new URLSearchParams(location.search).get('demo') === '1') return true
    } catch {
      /* ignore */
    }
    return false
  }

  function hasToken() {
    try {
      return !!(sessionStorage.getItem('huaxi-jwt-token') || localStorage.getItem('huaxi-jwt-token'))
    } catch {
      return false
    }
  }

  if (demoOnly() || hasToken()) return

  const next = '/app.html' + location.search + location.hash
  location.replace('/index.html?next=' + encodeURIComponent(next))
})()
